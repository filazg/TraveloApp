const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const { syncChannelServiceConfigData, syncCoreServiceConfigData, getChannelServiceConfigData } = require('./controllers/configServices/configSyncController');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

const startService = async ()=>{
    try {
        await syncChannelServiceConfigData()
        await syncCoreServiceConfigData()
        const config = await getChannelServiceConfigData()
        console.log(config)
        const router = require('./routes/routes');
        app.use('/', router);
        app.listen(config.services.portal.port, console.log('WEB PORTAL SERVICE started on port ' + config.services.portal.port));
    } catch (error) {
        console.log(error)
    }
}

startService()