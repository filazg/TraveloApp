const express = require('express')
const app = express()
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { syncDatabaseConfigData, getDatabaseConfigData, syncCoreServiceConfigData, getCoreServiceConfigData, syncChannelServiceConfigData, getChannelServiceConfigData } = require('./controllers/configSyncController');
const { initSequelize } = require('./config/database');
const { syncModels, initModels } = require('./dbModels');
const { travelo_subscriber } = require('./controllers/subscriberController');
const { syncHarborsDataController, syncLinesDataController, syncAllRoutesDataController } = require('./controllers/syncControllers/syncBoatServiceController');
const { syncBusinessPremisesController } = require('./controllers/syncControllers/syncBackofficeControllers');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))
app.set('trust proxy', 1);

app.use(cors({
  origin: [
    "http://localhost:5181",
    "http://192.168.0.100:5181",
    "http://192.168.0.101:5181",
    "http://10.71.117.225:5181",
    ],
  credentials: true,
}));

const syncData = ()=>{
    syncHarborsDataController()
    syncLinesDataController()
    syncAllRoutesDataController()
    syncBusinessPremisesController()
}

const startService = async ()=>{
    try {
        await syncChannelServiceConfigData()
        await syncCoreServiceConfigData()
        await syncDatabaseConfigData()
        const config = await getChannelServiceConfigData()
        const databseConfig = await getDatabaseConfigData()
        await initSequelize(databseConfig);
        const models = initModels();
        app.locals.models = models;
        await syncModels({ alter: false });
        const router = require('./routes/routes');
        app.use('/', router);
        travelo_subscriber('travelo_web_sales_service')
        syncData()
        app.listen(config.services.web_sales.port, console.log('WEB SALES SERVICE started on port ' + config.services.web_sales.port));
    } catch (error) {
        console.log(error)
    }
}

startService()