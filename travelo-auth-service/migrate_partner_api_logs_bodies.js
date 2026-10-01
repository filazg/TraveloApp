// Sadržaj zahtjeva i odgovora u logu spajanja partnera (Sistem → API partneri).
//
// Tablica partner_api_logs nastaje sama (sync), ali auth-servis se diže sa
// `sync({ alter: false })`, pa stupci dodani kasnije ne nastaju sami. Bez ove
// migracije upis loga puca s "column request_body does not exist" — upis je
// best-effort, pa partner to ne osjeti, ali zapisa nema.
//
// Pokretanje:  node migrate_partner_api_logs_bodies.js
// Idempotentno (IF NOT EXISTS).
const { Sequelize } = require("sequelize");
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
    await sequelize.authenticate();
    await sequelize.query(`ALTER TABLE IF EXISTS partner_api_logs ADD COLUMN IF NOT EXISTS request_body TEXT`);
    await sequelize.query(`ALTER TABLE IF EXISTS partner_api_logs ADD COLUMN IF NOT EXISTS response_body TEXT`);
    console.log("  · kolone request_body, response_body");
    await sequelize.close();
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e?.message || e);
    process.exit(1);
});
