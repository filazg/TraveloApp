// Dodaje `tickets.seop_cvikanje_transakcija` — marker da je karta cvikana
// (ukrcaj dojavljen SEOP-u). Bez njega životni ciklus (seopLifecycle) ne može
// razlikovati „prodano" od „cvikano", pa bi poništenje ukrcaja moglo otići i za
// kartu koja nikad nije cvikana. Idempotentno (IF NOT EXISTS).
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();

    const [, meta] = await sequelize.query(
        `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_cvikanje_transakcija VARCHAR(255)`
    );
    console.log(`  · tickets.seop_cvikanje_transakcija dodano (rowCount: ${meta?.rowCount ?? "n/a"})`);
    console.log("\n✓ migracija markera cvikanja gotova");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
