// Dodatne karte (dojenče uz kartu roditelja) — stupci tickets.is_extra i
// tickets.extra_of_ticket_uuid. Servis se diže sa sync({ alter: false }), pa ih
// treba dodati ovako. Idempotentno (IF NOT EXISTS).
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    await initSequelize(await getDatabaseConfigData());
    const sequelize = getSequelize();
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT false`);
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS extra_of_ticket_uuid VARCHAR(255)`);
    console.log("  · kolone tickets.is_extra, tickets.extra_of_ticket_uuid");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
