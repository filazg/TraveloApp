const { getSequelize } = require("../config/database");
const { route } = require("../routes/routes");
const boatsModelsFactory = require("./boats.models");
const departuresModelsFactory = require("./departures,models");
const harborsModelsFactory = require("./harbors.models");
const linesModelsFactory = require("./lines.models");
const regionsModelsFactory = require("./regions.models");
const routesModelsFactory = require("./routes.models");
const ticketsTypesModelsFactory = require("./ticketsTypes.models");
const timetablesModelsFactory = require("./timetables.models");
const timetablesPricesModelsFactory = require("./timetablesPrices.models");

let models = null;

function initModels() {
  if (!models) {
    const sequelize = getSequelize();

    models = {
      ...boatsModelsFactory(sequelize), 
      ...departuresModelsFactory(sequelize),
      ...harborsModelsFactory(sequelize),
      ...linesModelsFactory(sequelize),
      ...regionsModelsFactory(sequelize),
      ...routesModelsFactory(sequelize),
      ...ticketsTypesModelsFactory(sequelize),
      ...timetablesModelsFactory(sequelize),
      ...timetablesPricesModelsFactory(sequelize)
    };
  }

  return models;
}


async function syncModels(options = {}) {
  const sequelize = getSequelize();

  try {
    await sequelize.sync(options);
    console.log("BOAT SERVICE database synced...");
  } catch (err) {
    console.error("***ERROR*** DB sync failed", err.message);
    throw err;
  }
}

module.exports = {
  initModels,
  syncModels,
};
