const express = require('express')
const app = express()
const bodyParser = require('body-parser');

const { syncDatabaseConfigData, getDatabaseConfigData, syncCoreServiceConfigData, getCoreServiceConfigData, syncIntegrationsConfigData } = require('./controllers/configSyncController');
const { initSequelize } = require('./config/database');
const { syncModels, initModels } = require('./dbModels');
const { travelo_subscriber } = require('./controllers/subscriberController');
const { startPartnerInvoiceScheduler } = require('./controllers/partnerInvoiceScheduler');
const { startYescorStatusScheduler } = require('./controllers/yescorStatusScheduler');

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
        await syncModels({ alter: false });
        const router = require('./routes/routes');
        app.use('/', router);
        travelo_subscriber('travelo_transactions_service')
        startPartnerInvoiceScheduler();
        startYescorStatusScheduler();
        app.listen(config.services.transactions.port, console.log('TRANSACTIONS SERVICE started on port ' + config.services.transactions.port));
    } catch (error) {
        console.log(error)
    }
}

startService()