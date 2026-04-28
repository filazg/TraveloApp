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

    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS vat_base NUMERIC(12,2) NOT NULL DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0;`);
    console.log("partner_invoices: vat_rate, vat_base, vat_amount added");

    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS fiskal_required BOOLEAN NOT NULL DEFAULT false;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_document_id VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_status VARCHAR(50) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_fiscalization_status VARCHAR(50) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_error_message TEXT NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_concurrency_stamp VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS yescor_last_sync_at TIMESTAMPTZ NULL;`);
    console.log("partner_invoices: fiskal_required + yescor_* fields added");

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_partner_invoices_yescor_document
       ON partner_invoices (yescor_document_id)
       WHERE yescor_document_id IS NOT NULL;`
    );
    console.log("index idx_partner_invoices_yescor_document created");

    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
