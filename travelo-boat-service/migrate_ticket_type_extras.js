// Dodatne karte uz vrstu karte (npr. Redovna → dojenče) — JSONB stupac
// tickets_types.extra_tickets. Boat servis se diže sa sync({ alter: false }),
// pa stupac ne nastaje sam. Idempotentno (IF NOT EXISTS).
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();
    await sequelize.query(`ALTER TABLE tickets_types ADD COLUMN IF NOT EXISTS extra_tickets JSONB`);
    console.log("  · kolona tickets_types.extra_tickets");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
