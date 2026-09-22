// Oznaka odakle je popust na povlaštenoj karti: "seop" ili "lokalni_katalog".
//
// Zatečene karte se sijeju iz onoga što već nose: popust uz offline prodaju nije
// mogao doći sa SEOP-a, a popust uz provjerenu prodaju jest. Karte bez popusta
// ostaju bez oznake. Idempotentno (IF NOT EXISTS).
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();

    await sequelize.query(
        `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_popust_izvor varchar(255)`
    );
    console.log("  · kolona seop_popust_izvor");

    const [, lokalni] = await sequelize.query(
        `UPDATE tickets SET seop_popust_izvor = 'lokalni_katalog'
          WHERE seop_popust_izvor IS NULL
            AND seop_offline = true
            AND COALESCE(seop_discount_pct, 0) > 0`
    );
    console.log(`  · lokalni_katalog: ${lokalni?.rowCount ?? "?"} karata`);

    const [, seop] = await sequelize.query(
        `UPDATE tickets SET seop_popust_izvor = 'seop'
          WHERE seop_popust_izvor IS NULL
            AND COALESCE(seop_offline, false) = false
            AND COALESCE(seop_discount_pct, 0) > 0`
    );
    console.log(`  · seop: ${seop?.rowCount ?? "?"} karata`);

    console.log("\n✓ migracija izvora popusta gotova");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
