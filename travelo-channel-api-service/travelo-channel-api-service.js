const express = require('express');
const bodyParser = require('body-parser');
const {
    syncChannelServiceConfigData,
    syncCoreServiceConfigData,
    syncMainServiceConfigData,
    getChannelServiceConfigData,
} = require('./controllers/configServices/configSyncController');

const app = express();

// Trust nginx (single hop) so req.ip / X-Forwarded-For is the real client.
app.set('trust proxy', 1);

app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.json({ limit: "10mb" }));

const startService = async () => {
    try {
        await syncChannelServiceConfigData();
        await syncCoreServiceConfigData();
        await syncMainServiceConfigData();
        const config = await getChannelServiceConfigData();
        const router = require('./routes/routes');
        app.use('/', router);
        app.listen(config.services.api.port, () =>
            console.log('API SERVICE started on port ' + config.services.api.port)
        );
    } catch (error) {
        console.log(error);
    }
};

startService();
