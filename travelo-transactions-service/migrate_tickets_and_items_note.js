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
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS order_note VARCHAR(255) NULL;`);
    console.log("tickets.order_note added");
    await sequelize.query(`ALTER TABLE partner_invoice_items ADD COLUMN IF NOT EXISTS order_uuid VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoice_items ADD COLUMN IF NOT EXISTS order_note VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoice_items ADD COLUMN IF NOT EXISTS sale_datetime TIMESTAMPTZ NULL;`);
    console.log("partner_invoice_items: order_uuid, order_note, sale_datetime added");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
