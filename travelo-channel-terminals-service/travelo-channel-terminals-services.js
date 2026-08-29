const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const { syncChannelServiceConfigData, syncCoreServiceConfigData, syncIntegrationsConfigData, getChannelServiceConfigData } = require('./controllers/configServices/configSyncController');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

const startService = async ()=>{
    try {
        await syncChannelServiceConfigData()
        await syncCoreServiceConfigData()
        await syncIntegrationsConfigData()
        const config = await getChannelServiceConfigData()
        const router = require('./routes/routes');
        app.use('/', router);
        // Nadzor promjena krece odmah, ne tek kad se prvi uredaj spoji: cim se
        // polazak otkaze, memorija slozenog plovidbenog reda mora biti ocistena,
        // inace uredaj koji ga zatrazi dobije sliku od prije promjene.
        require('./handlers/syncSignalWatcher').pokreni();
        app.listen(config.services.terminals.port, console.log('TERMINALS SERVICE started on port ' + config.services.terminals.port));
    } catch (error) {
        console.log(error)
    }
}

startService()