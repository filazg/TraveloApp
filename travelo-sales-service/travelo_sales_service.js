const express = require('express')
const app = express()
const bodyParser = require('body-parser');

const { syncDatabaseConfigData, getDatabaseConfigData, syncCoreServiceConfigData, getCoreServiceConfigData } = require('./controllers/configSyncController');
const { initSequelize } = require('./config/database');
const { syncModels, initModels } = require('./dbModels');
const { travelo_subscriber } = require('./controllers/subscriberController');
const { syncHarborsDataController, syncLinesDataController, syncRoutesDataController, syncAllRoutesDataController } = require('./controllers/syncControllers/syncBoatServiceController');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

const syncData = ()=>{
    syncHarborsDataController()
    syncLinesDataController()
    syncAllRoutesDataController()
}

const startService = async ()=>{
    try {
        await syncCoreServiceConfigData()
        await syncDatabaseConfigData()
        const config = await getCoreServiceConfigData()
        const databseConfig = await getDatabaseConfigData()
        await initSequelize(databseConfig);
        const models = initModels();
        app.locals.models = models;
        await syncModels({ alter: true });
        const router = require('./routes/routes');
        app.use('/', router);
        travelo_subscriber('travelo_sales_service')
        syncData()
        app.listen(config.services.sales.port, console.log('SALES SERVICE started on port ' + config.services.sales.port));
    } catch (error) {
        console.log(error)
        // Start nije uspio (najčešće baza) — izađi da ga pm2 restarta.
        // Bez ovoga proces ostaje "online", ali nikad ne otvori svoj port,
        // pa svaki poziv puca s 500 i izgleda kao greška u aplikaciji.
        process.exit(1);
    }
}

startService()