const { getSequelize } = require("../config/database");
const invoiceModelsFactory = require("./invoice.models");
const ticketsModelsFactory = require("./tickets.models");
const bookingModelsFactory = require("./booking.models");
const partnerInvoiceModelsFactory = require("./partnerInvoice.models");
const partnerCommissionReportModelsFactory = require("./partnerCommissionReport.models");
const shiftModelsFactory = require("./shift.models");
const apiOrdersModelsFactory = require("./apiOrders.models");
const paymentOrdersModelsFactory = require("./paymentOrders.models");
const syncSignalsModelsFactory = require("./syncSignals.models");

let models = null;

function initModels() {
  if (!models) {
    const sequelize = getSequelize();

    models = {
      ...invoiceModelsFactory(sequelize),
      ...ticketsModelsFactory(sequelize),
      ...bookingModelsFactory(sequelize),
      ...partnerInvoiceModelsFactory(sequelize),
      ...partnerCommissionReportModelsFactory(sequelize),
      ...shiftModelsFactory(sequelize),
      ...apiOrdersModelsFactory(sequelize),
      ...paymentOrdersModelsFactory(sequelize),
      ...syncSignalsModelsFactory(sequelize)
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
    console.log("TRANSACTIONS SERVICE database synced...");
  } catch (err) {
    console.error("***ERROR*** TRANSACTIONS DB sync failed", err.message);
    throw err;
  }
}

module.exports = {
  initModels,
  getModels,
  syncModels,
};
