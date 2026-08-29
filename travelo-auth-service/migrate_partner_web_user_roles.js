// Uloge korisnika partnerske prodaje.
//
// Sto korisnik smije — prodaju ili financije — odlucuje se u backofficeu, a
// ovamo dolazi sinkronizacijom. Auth-servis se dize sa `sync({ alter: false })`,
// pa novi stupac iz modela ne nastaje sam: dok migracija ne prode, sinkronizacija
// puca s "column roles does not exist", a prijava partnera vraca 500.
//
// Pokretanje:  node migrate_partner_web_user_roles.js
//              APP_ENV=test_do DB_PASS='...' node migrate_partner_web_user_roles.js
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
        await sequelize.query(
            `ALTER TABLE partners_web_users
             ADD COLUMN IF NOT EXISTS roles VARCHAR(255) NOT NULL DEFAULT 'SALES';`
        );
        console.log("partners_web_users.roles spreman");

        const razrada = await sequelize.query(
            `SELECT username, roles FROM partners_web_users ORDER BY username`,
            { type: QueryTypes.SELECT }
        );
        for (const r of razrada) console.log(`  ${r.username}: ${r.roles}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
