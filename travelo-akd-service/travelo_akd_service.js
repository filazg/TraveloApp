const express = require('express');
const app = express();

const {
    syncCoreServiceConfigData,
    syncIntegrationsConfigData,
    getCoreServiceConfigData,
} = require('./controllers/configSyncController');

app.use(express.json({ limit: '2mb' }));

const startService = async () => {
    try {
        await syncCoreServiceConfigData();
        await syncIntegrationsConfigData();
        const config = getCoreServiceConfigData();
        const port = config?.services?.akd?.port || 7070;
        const router = require('./routes/routes');
        app.use('/', router);
        app.listen(port, () => console.log('AKD SERVICE started on port ' + port));
    } catch (err) {
        console.log('AKD SERVICE startup error:', err?.message || err);
    }
};

startService();
