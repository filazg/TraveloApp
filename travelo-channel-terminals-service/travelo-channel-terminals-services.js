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
        const router = require('./routes/routes');
        app.use('/', router);
        app.listen(config.services.terminals.port, console.log('TERMINALS SERVICE started on port ' + config.services.terminals.port));
    } catch (error) {
        console.log(error)
    }
}

startService()