const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const { syncChannelServiceConfigData, syncCoreServiceConfigData, getChannelServiceConfigData } = require('./controllers/configServices/configSyncController');

app.set('trust proxy', 1);
app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

// Per-IP global limiter — portal is admin-only but still public-facing through nginx.
// Generous max because admins click through CRUD pages quickly.
const portalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Try again in a minute." },
});
app.use(portalLimiter);

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
