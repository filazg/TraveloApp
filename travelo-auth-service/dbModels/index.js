const { getSequelize } = require("../config/database");
const usersModelsFactory  = require("./users.models");
const terminalsModelsFactory  = require("./terminals.models");
const partnersWebUsersModelsFactory = require("./partnersWebUsers.models");
const partnersApiUsersModelsFactory = require("./partnersApiUsers.models");

let models = null;

function initModels() {
  if (!models) {
    const sequelize = getSequelize();

    models = {
      ...usersModelsFactory(sequelize),
      ...terminalsModelsFactory(sequelize),
      ...partnersWebUsersModelsFactory(sequelize),
      ...partnersApiUsersModelsFactory(sequelize),
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
    console.log("AUTH SERVICE database synced...");
  } catch (err) {
    console.error("***ERROR*** DB sync failed", err.message);
    throw err;
  }
}

module.exports = {
  initModels,
  syncModels,
  getModels
};
