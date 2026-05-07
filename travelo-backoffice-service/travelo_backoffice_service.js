const express = require('express')
const app = express()
const bodyParser = require('body-parser');

const { syncDatabaseConfigData, getDatabaseConfigData, syncCoreServiceConfigData, getCoreServiceConfigData, syncIntegrationsConfigData } = require('./controllers/configSyncController');
const {initSequelize} = require('./config/database');
const { syncModels, initModels } = require('./dbModels');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

const startService = async ()=>{
    try {
        await syncCoreServiceConfigData()
        await syncDatabaseConfigData()
        await syncIntegrationsConfigData()
        const config = await getCoreServiceConfigData()
        const databseConfig = await getDatabaseConfigData()
        await initSequelize(databseConfig);
        const models = initModels();
        app.locals.models = models;
        await syncModels({ alter: true });
        const router = require('./routes/routes');
        app.use('/', router);
        app.listen(config.services.backoffice.port, console.log('BACKOFFICE SERVICE started on port ' + config.services.backoffice.port));
    } catch (error) {
        console.log(error)
    }
}

startService()