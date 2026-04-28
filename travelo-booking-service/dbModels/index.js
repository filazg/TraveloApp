const { getSequelize } = require("../config/database");
const capacityCategoriesFactory = require("./capacityCategories.models");
const ticketTypeMappingsFactory = require("./ticketTypeMappings.models");
const bookingsFactory = require("./bookings.models");

let models = null;

function initModels() {
    if (!models) {
        const sequelize = getSequelize();
        models = {
            ...capacityCategoriesFactory(sequelize),
            ...ticketTypeMappingsFactory(sequelize),
            ...bookingsFactory(sequelize),
        };
    }
    return models;
}

function getModels() {
    if (!models) throw new Error("Models not initialized");
    return models;
}

async function syncModels(options = {}) {
    const sequelize = getSequelize();
    try {
        await sequelize.sync(options);
        console.log("BOOKING SERVICE database synced...");
    } catch (err) {
        console.error("***ERROR*** BOOKING DB sync failed", err.message);
        throw err;
    }
}

module.exports = { initModels, getModels, syncModels };
