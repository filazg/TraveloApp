const express = require('express')
const app = express()
const cors = require("cors");
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");

const { syncDatabaseConfigData, syncMainServiceConfigData, syncChannalServiceConfigData, getMainServiceConfigData, syncCoreServiceConfigData, getDatabaseConfigData } = require('./controllers/configSyncController');
const { initModels, syncModels } = require('./dbModels');
const { initSequelize } = require('./config/database');
const { travelo_subscriber } = require('./controllers/subscriberController');
const { syncUsersDataController, syncTerminalsDataController, syncPartnersWebUsersDataController } = require('./controllers/syncControllers/syncBackOfficeServiceController');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))
app.use(cookieParser());

app.use(cors({
  origin: ["http://localhost:5182", "http://localhost:5183"],
  credentials: true,
}));

//app.options("/*", cors({ origin: "http://localhost:5182", credentials: true }));

//mb_subscriber('t4b_cloud_auth_service')

const syncData = ()=>{
    syncUsersDataController()
    syncTerminalsDataController()
    syncPartnersWebUsersDataController()
}

const startService = async ()=>{
    try {
        await syncMainServiceConfigData()
        await syncChannalServiceConfigData()
        await syncCoreServiceConfigData()
        await syncDatabaseConfigData()
        const config = await getMainServiceConfigData()
        const databseConfig = await getDatabaseConfigData()
        await initSequelize(databseConfig);
        const models = initModels();
        app.locals.models = models;
        await syncModels({ alter: false });
        const router = require('./routes/routes');
        app.use('/', router);
        travelo_subscriber('travelo_auth_service')
        syncData()
        app.listen(config.services.auth.port, console.log('AUTH SERVICE started on port ' + config.services.auth.port));
    } catch (error) {
        console.log(error)
    }
}

startService()