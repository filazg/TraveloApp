const { Sequelize } = require("sequelize");

const dbConfig = {
  db_name: "travelo-backoffice-db",
  db_username: "doadmin",
  db_pass: process.env.DB_PASS,
  db_port: 25060,
  db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};

(async () => {
  const sequelize = new Sequelize(
    dbConfig.db_name,
    dbConfig.db_username,
    dbConfig.db_pass,
    {
      host: dbConfig.db_host,
      port: dbConfig.db_port,
      dialect: "postgres",
      dialectOptions: {
        decimalNumbers: true,
        ssl: { require: true, rejectUnauthorized: false },
      },
      logging: false,
    }
  );

  try {
    await sequelize.authenticate();

    await sequelize.query(
      `ALTER TABLE partners ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0;`
    );
    console.log("partners.commission_pct added (NOT NULL DEFAULT 0)");

    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
