// Napomene uz luku za web prodaju (departure_note/_eng, arrival_note/_eng).
// Servis se diže sa sync({ alter: false }), pa stupci ne nastaju sami.
// Idempotentno. U web prodaji vrijednosti stižu sinkronizacijom luka iz boat
// servisa (pri pokretanju i pri svakom spremanju luke u portalu).
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");

(async () => {
    await syncDatabaseConfigData();
    await initSequelize(await getDatabaseConfigData());
    const sequelize = getSequelize();
    for (const col of ['departure_note', 'departure_note_eng', 'arrival_note', 'arrival_note_eng']) {
        await sequelize.query(`ALTER TABLE harbors ADD COLUMN IF NOT EXISTS ${col} TEXT`);
        console.log(`  · kolona harbors.${col}`);
    }
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
