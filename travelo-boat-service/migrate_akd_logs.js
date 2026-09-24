// Tablica zapisa poziva prema AKD-u (SEOP i MOSI).
//
// Dosad se jedini trag razgovora s AKD-om nalazio u `pm2 logs`, koji se rotira
// i u kojem se ne moze traziti po iskaznici ni po uredaju. Idempotentno
// (IF NOT EXISTS), pa se smije pokrenuti vise puta.
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    await initSequelize(await getDatabaseConfigData());
    const sequelize = getSequelize();

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS akd_logs (
            id serial PRIMARY KEY,
            sustav varchar(255) NOT NULL DEFAULT 'SEOP',
            metoda varchar(255),
            terminal_uuid varchar(255),
            terminal_tid varchar(255),
            terminal_naziv varchar(255),
            izvor varchar(255),
            iskaznica varchar(255),
            id_vrsta varchar(255),
            line_no varchar(255),
            relacija varchar(255),
            ok boolean NOT NULL DEFAULT true,
            http_status integer,
            greska_kod varchar(255),
            greska_opis text,
            trajanje_ms integer,
            okolina varchar(255),
            zahtjev text,
            odgovor text,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
        )
    `);
    console.log("  · tablica akd_logs");

    // Pretrazuje se po vremenu, uredaju, iskaznici i po tome je li poziv prosao.
    // Bez indeksa bi popis s par stotina tisuca zapisa cekao sekundama.
    for (const [naziv, stupac] of [
        ["akd_logs_created_idx", '"createdAt"'],
        ["akd_logs_terminal_idx", "terminal_uuid"],
        ["akd_logs_iskaznica_idx", "iskaznica"],
        ["akd_logs_ok_idx", "ok"],
    ]) {
        await sequelize.query(`CREATE INDEX IF NOT EXISTS ${naziv} ON akd_logs (${stupac})`);
    }
    console.log("  · indeksi");

    const [[{ count }]] = await sequelize.query(`SELECT count(*)::int AS count FROM akd_logs`);
    console.log(`  · zapisa u tablici: ${count}`);

    console.log("\n✓ migracija AKD loga gotova");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
