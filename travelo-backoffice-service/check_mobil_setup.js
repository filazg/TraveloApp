const { syncDatabaseConfigData, getDatabaseConfigData } = require('./controllers/configSyncController');
const { initSequelize } = require('./config/database');
const { initModels } = require('./dbModels');

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const { BusinessPremisesModel, BillingDevicesModel } = initModels();

    const bps = await BusinessPremisesModel.findAll();
    console.log('Business premises:');
    for (const bp of bps) {
        console.log(`  ${bp.uuid}  type=${bp.type}  name="${bp.name}"  active=${bp.is_active}`);
    }
    console.log('');

    const bds = await BillingDevicesModel.findAll();
    const bpById = new Map(bps.map(b => [b.uuid, b]));
    console.log('Billing devices (only those in MOBIL premise can pair on mobile):');
    for (const bd of bds) {
        const bp = bpById.get(bd.business_premise_uuid);
        const mobil = bp && String(bp.type).toUpperCase() === 'MOBIL';
        console.log(`  ${mobil ? '✓' : ' '} ${bd.uuid}  fm=${bd.fiscal_mark}  name="${bd.name}"  premise="${bp?.name || '?'}" (type=${bp?.type || '?'})`);
    }
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
