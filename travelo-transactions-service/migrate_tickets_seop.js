const { Sequelize } = require("sequelize");

const dbConfig = {
  db_name: "travelo-transactions-db",
  db_username: "doadmin",
  db_pass: process.env.DB_PASS,
  db_port: 25060,
  db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};

(async () => {
  const sequelize = new Sequelize(
    dbConfig.db_name, dbConfig.db_username, dbConfig.db_pass,
    {
      host: dbConfig.db_host, port: dbConfig.db_port, dialect: "postgres",
      dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
      logging: false,
    }
  );
  try {
    await sequelize.authenticate();
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_island BOOLEAN DEFAULT FALSE;`);
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_card_no VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_pravo VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_otok VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_discount_pct INTEGER;`);
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_ipk VARCHAR(255);`);
    console.log("tickets: SEOP polja dodana");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
