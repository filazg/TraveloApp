// Sets null capacity fields to 0 on boats and departures tables so bookings
// always initialize with non-null base capacities.
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();

    const updates = [
        `UPDATE boats SET capacity = 0 WHERE capacity IS NULL`,
        `UPDATE boats SET vip_capacity = 0 WHERE vip_capacity IS NULL`,
        `UPDATE boats SET pets_capacity = 0 WHERE pets_capacity IS NULL`,
        `UPDATE boats SET bicycle_capacity = 0 WHERE bicycle_capacity IS NULL`,
        `UPDATE departures SET base_capacity = 0 WHERE base_capacity IS NULL`,
        `UPDATE departures SET base_vip_capacity = 0 WHERE base_vip_capacity IS NULL`,
        `UPDATE departures SET base_pets_capacity = 0 WHERE base_pets_capacity IS NULL`,
        `UPDATE departures SET base_bicycle_capacity = 0 WHERE base_bicycle_capacity IS NULL`,
    ];

    for (const sql of updates) {
        const [, meta] = await sequelize.query(sql);
        console.log(`  · ${sql}   →  rows: ${meta?.rowCount ?? "?"}`);
    }
    console.log("\n✓ null → 0 migration (boats/departures) complete");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
