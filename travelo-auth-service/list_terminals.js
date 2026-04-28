const { syncDatabaseConfigData, getDatabaseConfigData } = require('./controllers/configSyncController');
const { initSequelize } = require('./config/database');
const { initModels } = require('./dbModels');

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const { TerminalsModel } = initModels();
    const rows = await TerminalsModel.findAll();
    console.log('Terminals ('+rows.length+'):');
    for (const r of rows) {
        console.log(`  uuid=${r.uuid}  tid=${r.tid}  otp=${r.otp}  serial=${r.serial_number}  active=${r.is_active}`);
    }
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
