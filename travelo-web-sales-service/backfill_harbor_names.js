// Preimenovanje luke u boat-servisu ne stiže do kopija u sales/web-sales
// (plovidbeni red se kopira pri aktivaciji, a naziv se drži denormalizirano).
// Zato desk, mobilna i POS i dalje pokazuju stari naziv. Ova skripta izjednači
// naziv luke na svim mjestima koja ga drže kao tekst, po poznatom preslikavanju
// staro→novo. NE dira `orders` — račun čuva naziv kakav je bio pri prodaji.
//
// Idempotentno; preskače tablice/stupce kojih u ovoj bazi nema. `--dry` samo
// prikaže koliko bi se redaka promijenilo.
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

const RENAMES = [
    { from: "Gruž", to: "Dubrovnik" },
    { from: "Silba / Žalić", to: "Silba" },
];

const JOBS = [
    { table: "harbors", cols: ["name"] },
    { table: "routes", cols: ["departure_harbor_name", "arrival_harbor_name"] },
    { table: "timetable_prices", cols: ["harbor_from", "harbor_to"] },
    { table: "lines", cols: ["first_harbor_name", "last_harbor_name"] },
];

(async () => {
    const dry = process.argv.includes("--dry");
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();

    console.log(dry ? "DRY-RUN — samo pregled, bez izmjena\n" : "PRIMJENA izmjena\n");

    for (const job of JOBS) {
        const [regRows] = await sequelize.query(`SELECT to_regclass(:t) AS reg`, { replacements: { t: job.table } });
        if (!regRows[0]?.reg) { console.log(`  (preskačem — nema tablice ${job.table})`); continue; }
        for (const col of job.cols) {
            const [colRows] = await sequelize.query(
                `SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c LIMIT 1`,
                { replacements: { t: job.table, c: col } }
            );
            if (!colRows.length) { console.log(`  (nema ${job.table}.${col})`); continue; }
            for (const r of RENAMES) {
                if (dry) {
                    const [rows] = await sequelize.query(
                        `SELECT COUNT(*)::int AS n FROM ${job.table} WHERE ${col} = :from`,
                        { replacements: { from: r.from } }
                    );
                    console.log(`  · ${(job.table + "." + col).padEnd(34)} "${r.from}" → "${r.to}"  redaka: ${rows[0].n}`);
                } else {
                    const [, meta] = await sequelize.query(
                        `UPDATE ${job.table} SET ${col} = :to WHERE ${col} = :from`,
                        { replacements: { from: r.from, to: r.to } }
                    );
                    console.log(`  · ${(job.table + "." + col).padEnd(34)} "${r.from}" → "${r.to}"  azurirano: ${meta?.rowCount ?? "?"}`);
                }
            }
        }
    }
    console.log(dry ? "\n(pokreni bez --dry za primjenu)" : "\n✓ backfill naziva luka gotov");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
