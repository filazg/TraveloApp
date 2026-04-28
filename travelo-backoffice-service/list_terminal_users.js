const { syncDatabaseConfigData, getDatabaseConfigData } = require('./controllers/configSyncController');
const { initSequelize } = require('./config/database');
const { initModels } = require('./dbModels');

const TERMINAL_UUID = process.argv[2] || null; // optional uuid arg

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const models = initModels();
    const { BillingDevicesModel, BillingDevicesPermissionsModel, UsersModel } = models;

    const devices = TERMINAL_UUID
        ? await BillingDevicesModel.findAll({ where: { uuid: TERMINAL_UUID } })
        : await BillingDevicesModel.findAll({ where: { is_active: true } });
    console.log(`Aktivnih terminala: ${devices.length}`);
    for (const d of devices) {
        const perms = await BillingDevicesPermissionsModel.findAll({ where: { billing_device_uuid: d.uuid } });
        const permUuids = perms.map(p => p.user_uuid || p.uuid).filter(Boolean);
        const attachedUsers = permUuids.length
            ? await UsersModel.findAll({ where: { uuid: permUuids } })
            : [];
        console.log(`  Terminal "${d.name}" (uuid=${d.uuid}  fm=${d.fiscal_mark})  users=[${attachedUsers.map(u=>u.username).join(', ')}]`);
    }
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
