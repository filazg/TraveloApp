// Resinkronizira denormalizirani naziv luke na svim mjestima koja ga drze kao
// tekst, iz mjerodavne tablice `harbors`. Plovidbeni red (routes/departures),
// cijene (timetable_prices) i linije nose kopiju naziva pa nakon preimenovanja
// luke ostanu na starom nazivu; ova skripta ih izjednaci s trenutnim.
//
// Kljucevi se razlikuju: routes/departures/timetable_prices vezu luku po KODU,
// linije po UUID-u (tako su i upisani pri kreiranju). Idempotentno — mijenja
// samo retke kojima naziv odstupa.
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

// Svaki posao: tablica, stupac naziva, stupac kljuca u toj tablici i stupac u
// `harbors` s kojim se spaja (code ili uuid).
const JOBS = [
    { tbl: "routes",           col: "departure_harbor_name", key: "departure_harbor_id", hkey: "code" },
    { tbl: "routes",           col: "arrival_harbor_name",   key: "arrival_harbor_id",   hkey: "code" },
    { tbl: "departures",       col: "departure_harbor_name", key: "departure_harbor_id", hkey: "code" },
    { tbl: "departures",       col: "arrival_harbor_name",   key: "arrival_harbor_id",   hkey: "code" },
    { tbl: "timetable_prices", col: "harbor_from",           key: "harbor_from_code",    hkey: "code" },
    { tbl: "timetable_prices", col: "harbor_to",             key: "harbor_to_code",      hkey: "code" },
    { tbl: "lines",            col: "first_harbor_name",     key: "first_harbor_id",     hkey: "uuid" },
    { tbl: "lines",            col: "last_harbor_name",      key: "last_harbor_id",      hkey: "uuid" },
];

const whereMismatch = (j, alias) =>
    `${alias}.${j.key} = h.${j.hkey} AND ${alias}.${j.col} IS DISTINCT FROM h.name`;

(async () => {
    const dry = process.argv.includes("--dry");
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();

    console.log(dry ? "DRY-RUN — samo pregled, bez izmjena\n" : "PRIMJENA izmjena\n");

    for (const j of JOBS) {
        if (dry) {
            // Pregled: koliko redaka odstupa + do 5 primjera staro → novo.
            const [rows] = await sequelize.query(
                `SELECT t.${j.col} AS staro, h.name AS novo, COUNT(*)::int AS n
                   FROM ${j.tbl} t JOIN harbors h ON ${whereMismatch(j, "t")}
                  GROUP BY t.${j.col}, h.name
                  ORDER BY n DESC LIMIT 5`
            );
            const ukupno = rows.reduce((s, r) => s + Number(r.n), 0);
            console.log(`  · ${(j.tbl + "." + j.col).padEnd(34)} redaka za promjenu: ${ukupno}`);
            for (const r of rows) console.log(`        "${r.staro}" → "${r.novo}"  (${r.n})`);
        } else {
            const [, meta] = await sequelize.query(
                `UPDATE ${j.tbl} t SET ${j.col} = h.name FROM harbors h WHERE ${whereMismatch(j, "t")}`
            );
            console.log(`  · ${(j.tbl + "." + j.col).padEnd(34)} azurirano redaka: ${meta?.rowCount ?? "?"}`);
        }
    }
    console.log(dry ? "\n(pokreni bez --dry za primjenu)" : "\n✓ backfill naziva luka gotov");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
