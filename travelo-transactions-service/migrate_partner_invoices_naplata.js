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
    // Postojeci zbirni racuni ostaju neplaceni dok se naplata ne potvrdi —
    // nista se ne prijavljuje samo od sebe, pa ih ne treba izuzimati.
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS invoice_paid BOOLEAN NOT NULL DEFAULT false;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS invoice_paid_date DATE NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS invoice_paid_type INTEGER NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS invoice_paid_confirmed_by VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS invoice_paid_confirmed_at TIMESTAMPTZ NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_payment_id VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_payment_status VARCHAR(50) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_payment_error TEXT NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_payment_last_sync_at TIMESTAMPTZ NULL;`);
    console.log("partner_invoices: invoice_paid_* + yescor_payment_* added");
    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
