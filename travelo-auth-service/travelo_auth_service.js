const express = require('express')
const app = express()
const cors = require("cors");
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");

const { syncDatabaseConfigData, syncMainServiceConfigData, syncChannalServiceConfigData, getMainServiceConfigData, syncCoreServiceConfigData, getDatabaseConfigData } = require('./controllers/configSyncController');
const { initModels, syncModels } = require('./dbModels');
const { initSequelize } = require('./config/database');
const { travelo_subscriber } = require('./controllers/subscriberController');
const { syncUsersDataController, syncTerminalsDataController, syncPartnersWebUsersDataController, syncPartnersApiUsersDataController } = require('./controllers/syncControllers/syncBackOfficeServiceController');

app.set('trust proxy', 1);
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
    syncPartnersApiUsersDataController()
}

// Kopija korisnika se osvjezava i sama, ne samo na event iz backofficea.
// Event putuje preko brokera i zna se izgubiti — broker padne, poruku pokupi
// drugi stack — a tada se promjena (npr. dodana uloga) ne vidi do sljedeceg
// restarta servisa. Korisnika je malo i mijenjaju se rijetko, pa je ovo jeftino.
const RAZMAK_OSVJEZAVANJA_MS = 5 * 60 * 1000
const pokreniPeriodicnoOsvjezavanje = () => {
    setInterval(() => {
        syncPartnersWebUsersDataController()
        syncPartnersApiUsersDataController()
    }, RAZMAK_OSVJEZAVANJA_MS).unref()
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
        pokreniPeriodicnoOsvjezavanje()
        app.listen(config.services.auth.port, console.log('AUTH SERVICE started on port ' + config.services.auth.port));
    } catch (error) {
        console.log(error)
        // Start nije uspio (najčešće baza) — izađi da ga pm2 restarta.
        // Bez ovoga proces ostaje "online", ali nikad ne otvori svoj port,
        // pa svaki poziv puca s 500 i izgleda kao greška u aplikaciji.
        process.exit(1);
    }
}

startService()