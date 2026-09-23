// Tablica popusta po pravu na povlašteni prijevoz (offline primjena).
//
// Tablica se stvara prazna: popust koji nitko nije odredio ne smije se
// izmisliti, pa se prava ne siju sa zadanim postotkom. Dok je tablica prazna,
// uređaji se ponašaju kao i dosad — bez mreže nema popusta.
// Idempotentno (IF NOT EXISTS).
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS seop_right_discounts (
            id serial PRIMARY KEY,
            code varchar(255) NOT NULL UNIQUE,
            discount_pct integer NOT NULL DEFAULT 0,
            is_active boolean NOT NULL DEFAULT true,
            updated_by varchar(255),
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
        )
    `);
    console.log("  · tablica seop_right_discounts");

    // Naziv na karti je dodan naknadno, pa ide zasebnim ALTER-om — postojece
    // instalacije ne smiju izgubiti upisane postotke.
    await sequelize.query(
        `ALTER TABLE seop_right_discounts ADD COLUMN IF NOT EXISTS ticket_label varchar(255)`
    );
    console.log("  · kolona ticket_label");

    const [[{ count }]] = await sequelize.query(`SELECT count(*)::int AS count FROM seop_right_discounts`);
    console.log(`  · upisanih prava: ${count}`);

    console.log("\n✓ migracija popusta po pravu gotova");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
