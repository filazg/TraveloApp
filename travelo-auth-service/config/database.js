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

    // DNS prema DO clusteru zna zakazati na par sekundi (npr. nakon buđenja
    // stroja). Bez ponovnog pokušaja servis bi ostao živ ali bez baze — zato
    // pet pokušaja s rastućom odgodom prije nego odustanemo.
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await sequelize.authenticate();
        console.log("AUTH SERVICE database connected...");
        break;
      } catch (err) {
        if (attempt === MAX_ATTEMPTS) {
          console.error("***ERROR*** AUTH SERVICE database connection", err.message);
          throw err;
        }
        const waitMs = 2000 * 2 ** (attempt - 1);
        console.error(
          `***ERROR*** AUTH SERVICE database connection (pokušaj ${attempt}/${MAX_ATTEMPTS}): ${err.message} — ponovni pokušaj za ${waitMs / 1000}s`
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
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
