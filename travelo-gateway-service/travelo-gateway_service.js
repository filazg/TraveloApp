const express = require('express')
const app = express()
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");

const { syncChannalServiceConfigData, syncMainServiceConfigData, syncCoreServiceConfigData, getMainServiceConfigData } = require('./controllers/configSyncController');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))
app.use(cookieParser());

app.use(cors({
  origin: [
    "http://localhost:5182",
    "http://192.168.0.101:5182",
    "http://192.168.1.100:5182",
    "http://localhost:5180",
    "http://localhost:5183",
    "http://192.168.0.101:5180",
    "http://192.168.0.100:5180",
    "http://192.168.0.100:5180/portal/",
    "http://192.168.1.100:5180",
    "http://192.168.0.104:5180",
    "https://bookingtest.krilo.hr",
    "https://bookingtest.krilo.hr/portal",
    "https://bookingtest.krilo.hr:5180",
    "https://bookingtest.krilo.hr/portal:5180",
    ],
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