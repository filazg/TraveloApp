const { companyModel, usersModel, paymentMethodsModel, stornoPercentagesModel, seopRightDiscountsModel, ticketTypeExtrasModel } = require("../db/models/BasicData.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");
const { salesRoutesDataModel, salesRoutePricesDataModel, linesDataModel, harborsDataModel } = require("../db/models/TransportData.cjs");


async function getLocalBasicDataService() {
  const [company, users, payment_methods, settings, storno_percentages, seop_right_discounts, ticket_type_extras] = await Promise.all([
    companyModel.findOne({attributes: { exclude: ["createdAt", "updatedAt"] }}),
    usersModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    paymentMethodsModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    systemSettingsDataModel.findOne({attributes: { exclude: ["createdAt", "updatedAt"] }}),
    stornoPercentagesModel.findAll({order: [["percentage", "DESC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    seopRightDiscountsModel.findAll({order: [["code", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    ticketTypeExtrasModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
  ]);

  return {
    company: company ? company.toJSON() : null,
    users: users.map((b) => b.toJSON()),
    payment_methods: payment_methods.map((r) => r.toJSON()),
    settings: settings ? settings.toJSON() : null,
    storno_percentages: (storno_percentages || []).map((s) => s.toJSON()),
    seop_right_discounts: (seop_right_discounts || []).map((s) => s.toJSON()),
    ticket_type_extras: (ticket_type_extras || []).map((s) => s.toJSON()),
    meta: { fetchedAt: new Date().toISOString() },
  };
}

async function getLocalTransportDataService() {
 const [ routes, route_prices, lines, harbors ] = await Promise.all([
    salesRoutesDataModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    salesRoutePricesDataModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    linesDataModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    harborsDataModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
  ]);
  // Vrste karata redom zadanim na plovidbenom redu (portal); bez poretka na
  // kraju, a unutar istog poretka kao dosad, po id-u.
  const poredak = (p) => (p.ticket_type_order == null ? Number.MAX_SAFE_INTEGER : Number(p.ticket_type_order));
  const cijene = route_prices.map((r) => r.toJSON())
    .sort((a, b) => poredak(a) - poredak(b) || a.id - b.id);
  return{
    routes: routes.map((b) => b.toJSON()),
    route_prices: cijene,
    lines: lines.map((l) => l.toJSON()),    
    harbors: harbors.map((h) => h.toJSON()),
    meta: { fetchedAt: new Date().toISOString() },
  }
}

module.exports = { 
    getLocalBasicDataService,
    getLocalTransportDataService
};