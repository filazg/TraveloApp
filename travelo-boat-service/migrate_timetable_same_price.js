// Zastavica "cijena jednaka za oba smjera" na plovidbenom redu.
//
// Kad je ukljucena, cijena relacije se unosi jednom (Split–Hvar) i vrijedi i za
// povratni smjer. Boat servis se dize sa `sync({ alter: false })`, pa stupac iz
// modela ne nastaje sam.
//
// Pokretanje:  node migrate_timetable_same_price.js
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
            `ALTER TABLE timetables ADD COLUMN IF NOT EXISTS same_price_both_ways BOOLEAN DEFAULT FALSE;`
        );
        // Zatecni redovi ostaju na dosadasnjem ponasanju: cijena po smjeru.
        await sequelize.query(
            `UPDATE timetables SET same_price_both_ways = FALSE WHERE same_price_both_ways IS NULL;`
        );
        const [stanje] = await sequelize.query(
            `SELECT COUNT(*)::int AS ukupno,
                    COUNT(*) FILTER (WHERE same_price_both_ways)::int AS oba_smjera
               FROM timetables`,
            { type: QueryTypes.SELECT }
        );
        console.log(`plovidbenih redova: ${stanje.ukupno}, s jednakom cijenom u oba smjera: ${stanje.oba_smjera}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
