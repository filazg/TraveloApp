const { getSequelize } = require("../config/database");
const companyModelsFactory = require("./company.models");
const businessPremisesModelsFactory  = require("./businessPremises.models");
const billingDevicesModelsFactory  = require("./billingDevices.models");
const usersModelsFactory  = require("./users.models");
const holidaysModelsFactory  = require("./holidays.models");
const partnersModelsFactory  = require("./partners.modals");
const paymentMethodsModelsFactory  = require("./paymentMethods.models");
const paymentTypesModelsFactory  = require("./paymentTypes.models");
const addressbookModelsFactory  = require("./addressbook.models");
const countriesModelsFactory = require("./countries.models");
const accountsModelsFactory = require("./accounts.models");
const deviceSerialNumbersModelsFactory = require("./deviceSerialNumbers.models");
const channelSettingsModelsFactory = require("./channelSettings.models");
const stornoPercentagesModelsFactory = require("./stornoPercentages.models");
const webNoticesModelsFactory = require("./webNotices.models");

let models = null;

function initModels() {
  if (!models) {
    const sequelize = getSequelize();

    models = {
      ...companyModelsFactory(sequelize),
      ...businessPremisesModelsFactory(sequelize),
      ...billingDevicesModelsFactory(sequelize),
      ...usersModelsFactory(sequelize),
      ...holidaysModelsFactory(sequelize),
      ...partnersModelsFactory(sequelize),
      ...paymentMethodsModelsFactory(sequelize),
      ...paymentTypesModelsFactory(sequelize),
      ...addressbookModelsFactory(sequelize),
      ...countriesModelsFactory(sequelize),
      ...accountsModelsFactory(sequelize),
      ...deviceSerialNumbersModelsFactory(sequelize),
      ...channelSettingsModelsFactory(sequelize),
      ...stornoPercentagesModelsFactory(sequelize),
      ...webNoticesModelsFactory(sequelize),
    };
  }

  return models;
}


async function syncModels(options = {}) {
  const sequelize = getSequelize();

  try {
    await sequelize.sync(options);
    console.log("BACKOFFICE SERVICE database synced...");
  } catch (err) {
    console.error("***ERROR*** DB sync failed", err.message);
    throw err;
  }
}

module.exports = {
  initModels,
  syncModels,
};
