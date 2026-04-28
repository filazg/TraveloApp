
const { companyModel, usersModel, paymentMethodsModel } = require("../db/models/BasicData.cjs");


async function getInitialDataService() {
  const [company, users, payment_methods] = await Promise.all([
    companyModel.findOne({attributes: { exclude: ["createdAt", "updatedAt"] }}),
    usersModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
    paymentMethodsModel.findAll({order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }}),
  ]);

  return {
    company: company ? company.toJSON() : {},
    users: users.map((b) => b.toJSON()),
    payment_methods: payment_methods.map((r) => r.toJSON()),
    meta: { fetchedAt: new Date().toISOString() },
  };
}

module.exports = { getInitialDataService };