// Oznaka podrijetla karte.
//
// Pri zamjeni starog sustava preuzimaju se karte koje su ondje prodane, a kod
// nas se samo validiraju. Moraju se razlikovati od nase prodaje: ne stornira ih
// se i ne ulaze u promet, a bez oznake bi se u izvjestajima pomijesale.
//
// Transactions servis se dize sa `sync({ alter: false })`, pa stupac iz modela
// ne nastaje sam.
//
// Pokretanje:  node migrate_ticket_origin.js
//              APP_ENV=test_do DB_PASS='...' node migrate_ticket_origin.js
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
        await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS origin VARCHAR(255) NULL;`);
        // Uvoz trazi kartu po oznaci, da ponovno pokretanje ne stvori duplikat.
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_tickets_origin_code ON tickets(origin, ticket_code);`);
        console.log("tickets.origin spreman");

        const [stanje] = await sequelize.query(
            `SELECT COUNT(*)::int AS ukupno, COUNT(*) FILTER (WHERE origin IS NOT NULL)::int AS s_oznakom FROM tickets`,
            { type: QueryTypes.SELECT }
        );
        console.log(`karata: ${stanje.ukupno}, s oznakom podrijetla: ${stanje.s_oznakom}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
