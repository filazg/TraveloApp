// Cvikanje i poništenje cvika dobivaju zaseban prekidač za običnu i povlaštenu
// kartu (kao prodaja OPK/PPK). Dodaje 4 nove kolone i sije ih iz starih
// jedinstvenih (`send_cvikanje`, `send_ponisti_cvikanje`) ako te kolone postoje,
// da se ne izgubi dosadašnji izbor. Idempotentno (IF NOT EXISTS).
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();

    const ddl = [
        `ALTER TABLE seop_settings ADD COLUMN IF NOT EXISTS send_cvikanje_obicna boolean NOT NULL DEFAULT true`,
        `ALTER TABLE seop_settings ADD COLUMN IF NOT EXISTS send_cvikanje_povlastena boolean NOT NULL DEFAULT true`,
        `ALTER TABLE seop_settings ADD COLUMN IF NOT EXISTS send_ponisti_cvikanje_obicna boolean NOT NULL DEFAULT false`,
        `ALTER TABLE seop_settings ADD COLUMN IF NOT EXISTS send_ponisti_cvikanje_povlastena boolean NOT NULL DEFAULT false`,
    ];
    for (const sql of ddl) {
        await sequelize.query(sql);
        console.log("  ·", sql.replace(/^ALTER TABLE seop_settings ADD COLUMN IF NOT EXISTS /, "+ "));
    }

    // Sjetva iz starih kolona (ako još postoje) — čuva dosadašnji izbor brodara.
    const [stare] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'seop_settings' AND column_name IN ('send_cvikanje','send_ponisti_cvikanje')`
    );
    const imaStare = new Set(stare.map((r) => r.column_name));
    if (imaStare.has("send_cvikanje")) {
        const [, m] = await sequelize.query(
            `UPDATE seop_settings SET send_cvikanje_obicna = send_cvikanje, send_cvikanje_povlastena = send_cvikanje`
        );
        console.log(`  · sijem cvikanje iz send_cvikanje (redaka: ${m?.rowCount ?? "?"})`);
    }
    if (imaStare.has("send_ponisti_cvikanje")) {
        const [, m] = await sequelize.query(
            `UPDATE seop_settings SET send_ponisti_cvikanje_obicna = send_ponisti_cvikanje, send_ponisti_cvikanje_povlastena = send_ponisti_cvikanje`
        );
        console.log(`  · sijem poništenje iz send_ponisti_cvikanje (redaka: ${m?.rowCount ?? "?"})`);
    }

    console.log("\n✓ migracija split cvikanja gotova");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
