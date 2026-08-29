// Tablica signala za osvjezavanje uredaja.
//
// Blagajna i mobilna povlace podatke same; bez signala ne saznaju za storno
// karte ni za otkaz polaska dok korisnik sam ne pokrene osvjezavanje. Tablica
// drzi brojac po vrsti podatka, pa uredaj cesto pita "je li se sto promijenilo"
// i dobiva par bajtova umjesto cijelog paketa.
//
// Transactions servis se dize sa `sync({ alter: false })`, pa tablica iz modela
// ne nastaje sama.
//
// Pokretanje:  node migrate_sync_signals.js
//              APP_ENV=test_do DB_PASS='...' node migrate_sync_signals.js
const { Sequelize, QueryTypes } = require("sequelize");
const { syncCoreServiceConfigData, syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");

(async () => {
    await syncCoreServiceConfigData();
    await syncDatabaseConfigData();
    const cfg = await getDatabaseConfigData();
    if (!cfg?.db_pass) {
        throw new Error("control-service nije vratio lozinku baze — provjeri DB_PASS u njegovoj okolini");
    }
    console.log(`baza: ${cfg.db_name} @ ${cfg.db_host}`);
    const sequelize = new Sequelize(cfg.db_name, cfg.db_username, cfg.db_pass, {
        host: cfg.db_host,
        port: cfg.db_port,
        dialect: "postgres",
        dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
        logging: false,
    });

    try {
        await sequelize.authenticate();
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS sync_signals (
                id SERIAL PRIMARY KEY,
                kind VARCHAR(255) NOT NULL UNIQUE,
                revision INTEGER NOT NULL DEFAULT 0,
                last_event VARCHAR(255) NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log("tablica sync_signals spremna");

        // Pocetni redci, da uredaj i prije prvog dogadaja dobije broj s kojim se
        // moze usporediti.
        for (const kind of ["tickets", "transport"]) {
            await sequelize.query(
                `INSERT INTO sync_signals (kind, revision) VALUES (:kind, 0) ON CONFLICT (kind) DO NOTHING`,
                { replacements: { kind } }
            );
        }

        const stanje = await sequelize.query(
            `SELECT kind, revision, last_event FROM sync_signals ORDER BY kind`,
            { type: QueryTypes.SELECT }
        );
        for (const r of stanje) console.log(`  ${r.kind}: ${r.revision}${r.last_event ? ` (${r.last_event})` : ""}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
