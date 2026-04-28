const { getSequelize } = require("../config/database");

const harborsModelsFactory = require("./harbors.models");
const linesModelsFactory = require("./lines.models");
const routesModelsFactory = require("./routes.models");
const timetablesPricesModelsFactory = require("./timetablesPrices.models");
const businessPremisesModelsFactory = require("./businessPremises.models");

let models = null;

function initModels() {
  if (!models) {
    const sequelize = getSequelize();

    models = {
        ...harborsModelsFactory(sequelize),
        ...linesModelsFactory(sequelize),
        ...routesModelsFactory(sequelize),
        ...timetablesPricesModelsFactory(sequelize),
        ...businessPremisesModelsFactory(sequelize)
    };
  }

  return models;
}

function getModels() {
  if (!models) {
    throw new Error("Models not initialized. Call initModels() during app startup.");
  }
  return models;
}


async function syncModels(options = {}) {
  const sequelize = getSequelize();

  try {
    await sequelize.sync(options);
    console.log("SALES SERVICE database synced...");
  } catch (err) {
    console.error("***ERROR*** SALES DB sync failed", err.message);
    throw err;
  }
}

module.exports = {
  initModels,
  syncModels,
  getModels
};
