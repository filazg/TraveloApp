// Adds delay + note columns to routes table.
//   arrival_delay_minutes  INT   NULL
//   arrival_note           TEXT  NULL
//   departure_delay_minutes INT  NULL
//   departure_note         TEXT  NULL
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

    const adds = [
        { col: "arrival_delay_minutes", sql: "ALTER TABLE routes ADD COLUMN arrival_delay_minutes INTEGER NULL" },
        { col: "arrival_note", sql: "ALTER TABLE routes ADD COLUMN arrival_note TEXT NULL" },
        { col: "departure_delay_minutes", sql: "ALTER TABLE routes ADD COLUMN departure_delay_minutes INTEGER NULL" },
        { col: "departure_note", sql: "ALTER TABLE routes ADD COLUMN departure_note TEXT NULL" },
    ];

    for (const a of adds) {
        if (have.has(a.col)) {
            console.log("  · exists:", a.col);
        } else {
            await sequelize.query(a.sql);
            console.log("  + added:", a.col);
        }
    }

    console.log("\n✓ migration complete");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
