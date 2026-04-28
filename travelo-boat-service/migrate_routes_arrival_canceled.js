// Adds arrival_canceled BOOLEAN column to routes so we can mark a harbor as skipped
// without overwriting the leg's operational status.
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();
    const [existing] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'routes';
    `);
    const have = new Set(existing.map((r) => r.column_name));
    if (have.has("arrival_canceled")) {
        console.log("  · exists: arrival_canceled");
    } else {
        await sequelize.query("ALTER TABLE routes ADD COLUMN arrival_canceled BOOLEAN DEFAULT FALSE");
        console.log("  + added: arrival_canceled");
    }
    console.log("✓ migration complete");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
