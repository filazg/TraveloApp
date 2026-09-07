// ticket_templates — predložak PDF karte po prodajnom kanalu.
const { Sequelize } = require("sequelize");

const dbConfig = {
  db_name: "travelo-boat-db",
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
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ticket_templates (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(50) NOT NULL UNIQUE,
        template_key VARCHAR(50) NOT NULL,
        summary_threshold INTEGER NOT NULL DEFAULT 3,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    console.log("ticket_templates: tablica spremna");
  } catch (e) {
    console.error("migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
