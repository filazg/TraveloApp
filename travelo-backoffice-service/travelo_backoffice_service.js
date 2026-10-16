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

        // Adresar iz SAOP-a: kupce otvara i knjigovodstvo, pa se povlace
        // periodicki (env SAOP_ADRESAR_SYNC_MIN, default 60; 0 = iskljuceno).
        // Prvi uvoz minutu nakon starta, da ne usporava podizanje servisa.
        const sinkMin = Number(process.env.SAOP_ADRESAR_SYNC_MIN ?? 60);
        if (sinkMin > 0) {
            const { uveziIzSaopa } = require('./controllers/dataControllers/addressbookDataControllers');
            const uvezi = () => uveziIzSaopa(models.AddressbookModel)
                .catch((e) => console.log('adresar iz SAOP-a nije uvezen:', e?.message || e));
            setTimeout(uvezi, 60 * 1000);
            setInterval(uvezi, sinkMin * 60 * 1000);
        }
    } catch (error) {
        console.log(error)
        // Start nije uspio (najčešće baza) — izađi da ga pm2 restarta.
        // Bez ovoga proces ostaje "online", ali nikad ne otvori svoj port,
        // pa svaki poziv puca s 500 i izgleda kao greška u aplikaciji.
        process.exit(1);
    }
}

startService()