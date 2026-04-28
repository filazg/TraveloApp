const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const { syncChannelServiceConfigData, syncCoreServiceConfigData, getChannelServiceConfigData } = require('./controllers/configServices/configSyncController');
const { searchTripsHandlers } = require('./handlers/searchTripsHandlers');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

const dataToSend = {
    body:{
        travel_from:'HR458',
        travel_to:'HR546',
        travel_date:'2026-03-14',
        control_code:'f7c27c0b985526467269ebece424b3a03c6dee9d848a095164a53cf17f4a223c9bc83814eef7949afa25aff8cb2a2608b98b950529b394f84464832014851d29'
    },
    header:{
        k:'gadfgadfhgadh'
    }
}

const startService = async ()=>{
    try {
        await syncChannelServiceConfigData()
        await syncCoreServiceConfigData()
        const config = await getChannelServiceConfigData()
        const router = require('./routes/routes');
        app.use('/', router);
        searchTripsHandlers(dataToSend)
        app.listen(config.services.api.port, console.log('API SERVICE started on port ' + config.services.api.port));
    } catch (error) {
        console.log(error)
    }
}

startService()