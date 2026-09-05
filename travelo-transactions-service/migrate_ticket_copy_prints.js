// ticket_copy_prints — evidencija ispisa kopija karata.
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
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ticket_copy_prints (
        id SERIAL PRIMARY KEY,
        ticket_uuid VARCHAR(255) NOT NULL,
        ticket_code VARCHAR(255) NULL,
        copy_no INTEGER NOT NULL,
        suffix VARCHAR(8) NULL,
        printed_at TIMESTAMPTZ NOT NULL,
        operator_uuid VARCHAR(255) NULL,
        operator_name VARCHAR(255) NULL,
        billing_device_uuid VARCHAR(255) NULL,
        billing_device_name VARCHAR(255) NULL,
        business_premise_name VARCHAR(255) NULL,
        origin VARCHAR(50) NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    // Kopije se gotovo uvijek traže po karti — i pri dodjeli sljedećeg rednog
    // broja i pri pregledu.
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_copy_prints_ticket ON ticket_copy_prints (ticket_uuid);`);
    console.log("ticket_copy_prints: tablica i indeks spremni");
  } catch (e) {
    console.error("migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
