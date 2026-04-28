// electron/db/index.cjs
const path = require("path");
const { app } = require("electron");
const { Sequelize } = require("sequelize");

const dbPath = path.join(app.getPath("userData"), "travelo.sqlite");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./travelo.sqlite",
  //storage: dbPath,
  logging: false
});

module.exports = {
  sequelize
};
