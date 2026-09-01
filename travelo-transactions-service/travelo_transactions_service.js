const express = require('express')
const app = express()
const bodyParser = require('body-parser');

const { syncDatabaseConfigData, getDatabaseConfigData, syncCoreServiceConfigData, getCoreServiceConfigData, syncChannelServiceConfigData, syncIntegrationsConfigData } = require('./controllers/configSyncController');
const { initSequelize } = require('./config/database');
const { syncModels, initModels } = require('./dbModels');
const { travelo_subscriber } = require('./controllers/subscriberController');
const { startPartnerInvoiceScheduler } = require('./controllers/partnerInvoiceScheduler');
const { startYescorStatusScheduler } = require('./controllers/yescorStatusScheduler');
const { startPartnerCommissionReportScheduler } = require('./controllers/partnerCommissionReportScheduler');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

// Nocni prolazi pisu u bazu, a lokalni dev i test VM dijele istu. Kad oba
// stacka vrte iste cronove, isti posao se radi dvaput: dedupe po razdoblju
// spasava od duplikata, ali brojevi izvjestaja i partnerskih racuna dodjeljuju
// se iz max(...)+1 bez zakljucavanja, pa istovremeni prolaz zna dati isti broj.
// Servis koji drzi podatke je VM; lokalno se cronovi gase preko
// TRAVELO_SCHEDULERS=off (postavljeno u ecosystem.local.config.js).
// Rucno pokretanje preko POST ruta radi i dalje, bez obzira na ovu zastavicu.
const SCHEDULERS_ON = String(process.env.TRAVELO_SCHEDULERS || "on").toLowerCase() !== "off";

const startService = async ()=>{
    try {
        await syncCoreServiceConfigData()
        await syncChannelServiceConfigData()
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
        if (SCHEDULERS_ON) {
            startPartnerInvoiceScheduler();
            startYescorStatusScheduler();
            startPartnerCommissionReportScheduler();
        } else {
            console.log("[schedulers] iskljuceni (TRAVELO_SCHEDULERS=off) — nocni prolazi se ovdje ne okidaju");
        }
        app.listen(config.services.transactions.port, console.log('TRANSACTIONS SERVICE started on port ' + config.services.transactions.port));
    } catch (error) {
        console.log(error)
        // Start nije uspio (najčešće baza) — izađi da ga pm2 restarta.
        // Bez ovoga proces ostaje "online", ali nikad ne otvori svoj port,
        // pa svaki poziv puca s 500 i izgleda kao greška u aplikaciji.
        process.exit(1);
    }
}

startService()