const express = require("express");
const bodyParser = require("body-parser");

const {
    syncCoreServiceConfigData,
    syncDatabaseConfigData,
    getCoreServiceConfigData,
    getDatabaseConfigData,
} = require("./controllers/configSyncController");
const { initSequelize } = require("./config/database");
const { initModels, syncModels } = require("./dbModels");
const seedDefaults = require("./helpers/seedDefaults");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.json({ limit: "10mb" }));

const startService = async () => {
    try {
        await syncCoreServiceConfigData();
        await syncDatabaseConfigData();
        const coreConfig = getCoreServiceConfigData();
        const dbConfig = getDatabaseConfigData();
        await initSequelize(dbConfig);
        const models = initModels();
        app.locals.models = models;
        await syncModels({ alter: false });
        await seedDefaults(models);
        const router = require("./routes/routes");
        app.use("/", router);
        const port = coreConfig?.services?.booking?.port || 7060;
        app.listen(port, () => console.log("BOOKING SERVICE started on port " + port));
    } catch (error) {
        console.log("BOOKING SERVICE startup error:", error?.message || error);
    }
};

startService();
