const { Sequelize } = require("sequelize");

let sequelize = null;

async function initSequelize(dbConfig) {
  if (!sequelize) {
    sequelize = new Sequelize(
      dbConfig.db_name,
      dbConfig.db_username,
      dbConfig.db_pass,
      {
        host: dbConfig.db_host,
        port: dbConfig.db_port,
        dialect: "postgres",

        dialectOptions: {
          decimalNumbers: true,
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },

        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },

        logging: false,
      }
    );

    try {
      await sequelize.authenticate();
      console.log("BOATS SERVICE database connected...");
    } catch (err) {
      console.error("***ERROR*** BOATS SERVICE database connection", err.message);
      throw err;
    }
  }

  return sequelize;
}

function getSequelize() {
  if (!sequelize) {
    throw new Error("Sequelize not initialized");
  }
  return sequelize;
}

module.exports = { initSequelize, getSequelize };
