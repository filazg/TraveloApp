// Prodaja na webu po vrsti karte — stupac tickets_types.web_sale. Boat servis
// se diže sa sync({ alter: false }), pa stupac ne nastaje sam. Idempotentno.
// Pri prvom dodavanju stupca Djelatna karta dobiva false: prodaje se samo na
// desku, a dosad se nudila i na webu.
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();
    const [postoji] = await sequelize.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_types' AND column_name = 'web_sale'`
    );
    await sequelize.query(`ALTER TABLE tickets_types ADD COLUMN IF NOT EXISTS web_sale BOOLEAN NOT NULL DEFAULT true`);
    console.log("  · kolona tickets_types.web_sale");
    if (!postoji.length) {
        const [, meta] = await sequelize.query(`UPDATE tickets_types SET web_sale = false WHERE name ILIKE 'Djelatna karta%'`);
        console.log(`  · Djelatna karta → samo desk (${meta?.rowCount ?? '?'} redaka)`);
    }
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
