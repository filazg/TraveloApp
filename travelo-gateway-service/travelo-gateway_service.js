const express = require('express')
const app = express()
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");

const { syncChannalServiceConfigData, syncMainServiceConfigData, syncCoreServiceConfigData, getMainServiceConfigData } = require('./controllers/configSyncController');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))
app.use(cookieParser());

// Origin je samo shema+host+port — putanje ("…/portal") preglednik nikad ne
// šalje, pa takvi unosi ništa ne znače. Dodatni origini se dodaju kroz
// PUBLIC_ORIGINS (odvojeni zarezom) da se za novu adresu ne dira kod.
const ALLOWED_ORIGINS = [
  "http://localhost:5180",
  "http://localhost:5182",
  "http://localhost:5183",
  "http://192.168.0.100:5180",
  "http://192.168.0.101:5180",
  "http://192.168.0.101:5182",
  "http://192.168.0.104:5180",
  "http://192.168.1.100:5180",
  "http://192.168.1.100:5182",
  "https://bookingtest.krilo.hr",
  "https://admintest.krilo.hr",
  ...String(process.env.PUBLIC_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
];

app.use(cors({
  origin: (origin, callback) => {
    // Bez origina su pozivi izvan preglednika (curl, servis-servis) — puštamo ih.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Bez ovog zapisa CORS izgleda kao greška aplikacije: preglednik javi samo
    // da je poziv blokiran, a poslužitelj šuti.
    console.log(`CORS: odbijen origin ${origin}. Dozvoljeni: ${ALLOWED_ORIGINS.join(", ")}`);
    return callback(null, false);
  },
  credentials: true,
}));


const startService = async ()=>{
    await syncMainServiceConfigData()
    await syncChannalServiceConfigData()
    await syncCoreServiceConfigData()
    const config = await getMainServiceConfigData()
    const router = require('./routes/routes');
    app.use('/', router);
    console.log(config)
    await app.listen(config.services.gateway_service.port, console.log('API GATEWAY SERVICE APP started on port ' + config.services.gateway_service.port));
}

startService()