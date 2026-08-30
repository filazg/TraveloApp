// Napomena uz plovidbeni red.
//
// Slobodan tekst, nije obavezan; vidi se u pregledu redova. Boat servis se dize
// sa `sync({ alter: false })`, pa stupac iz modela ne nastaje sam.
//
// Pokretanje:  node migrate_timetable_note.js
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
        await sequelize.query(`ALTER TABLE timetables ADD COLUMN IF NOT EXISTS note TEXT NULL;`);
        const [stanje] = await sequelize.query(
            `SELECT COUNT(*)::int AS ukupno,
                    COUNT(*) FILTER (WHERE note IS NOT NULL AND note <> '')::int AS s_napomenom
               FROM timetables`,
            { type: QueryTypes.SELECT }
        );
        console.log(`plovidbenih redova: ${stanje.ukupno}, s napomenom: ${stanje.s_napomenom}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
