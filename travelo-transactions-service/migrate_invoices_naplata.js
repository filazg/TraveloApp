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
    const [[{ postoji }]] = await sequelize.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'invoice_paid') AS postoji;`
    );

    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_paid_at_issue BOOLEAN NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_paid BOOLEAN NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_paid_date DATE NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_paid_type INTEGER NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_paid_confirmed_by VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_paid_confirmed_at TIMESTAMPTZ NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS yescor_payment_id VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS yescor_payment_status VARCHAR(50) NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS yescor_payment_error TEXT NULL;`);
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS yescor_payment_last_sync_at TIMESTAMPTZ NULL;`);
    console.log("invoices: invoice_paid_* + yescor_payment_* added");

    // Postojeci racuni su izdani prije ove podjele: vode se kao placeni pri
    // izdavanju, a naplata im se ne prijavljuje naknadno — inace bi prvi
    // prolaz schedulera poslao Poreznoj naplatu za sve stare F2 racune.
    if (!postoji) {
      const [, r] = await sequelize.query(
        `UPDATE invoices
            SET invoice_paid_at_issue = true,
                invoice_paid = true,
                invoice_paid_date = (invoice_date AT TIME ZONE 'Europe/Zagreb')::date,
                yescor_payment_status = 'not_applicable'
          WHERE invoice_paid IS NULL;`
      );
      console.log(`postojeci racuni oznaceni kao placeni: ${r?.rowCount ?? '?'}`);
    }

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_invoices_naplata_prijava
       ON invoices (yescor_payment_status)
       WHERE yescor_document_id IS NOT NULL;`
    );
    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
