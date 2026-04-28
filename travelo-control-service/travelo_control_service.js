const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const PORT  = 5000
const router = require('./routes/routes');
const { getActiveEnv } = require('./config/configResolver');

app.use(express.json({ limit: "10mb" }))
app.use(bodyParser.json({ limit: "10mb" }))

app.use('/', router);

app.listen(PORT, () => console.log(`CONTROL SERVICE APP started on port ${PORT} [env=${getActiveEnv()}]`));