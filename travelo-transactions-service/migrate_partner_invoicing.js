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
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS partner_uuid VARCHAR(255) NULL;`
    );
    await sequelize.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS partner_invoice_uuid VARCHAR(255) NULL;`
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_tickets_partner_unbilled
       ON tickets (partner_uuid)
       WHERE partner_invoice_uuid IS NULL;`
    );
    console.log("tickets: partner_uuid, partner_invoice_uuid + index added");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS partner_invoices (
        id SERIAL PRIMARY KEY,
        partner_invoice_uuid VARCHAR(255) NOT NULL,
        partner_invoice_no INTEGER NOT NULL,
        invoice_year INTEGER NOT NULL,
        invoice_date TIMESTAMPTZ NOT NULL,
        period_from TIMESTAMPTZ NOT NULL,
        period_to TIMESTAMPTZ NOT NULL,
        partner_uuid VARCHAR(255) NOT NULL,
        partner_name VARCHAR(255) NULL,
        partner_legal_id VARCHAR(255) NULL,
        partner_vat_id VARCHAR(255) NULL,
        partner_address VARCHAR(255) NULL,
        partner_postal_code VARCHAR(255) NULL,
        partner_town VARCHAR(255) NULL,
        partner_country VARCHAR(255) NULL,
        tickets_count INTEGER NOT NULL DEFAULT 0,
        gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
        commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'issued',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_invoice_uuid
       ON partner_invoices (partner_invoice_uuid);`
    );
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_invoice_year_no
       ON partner_invoices (invoice_year, partner_invoice_no);`
    );
    console.log("partner_invoices table ready");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS partner_invoice_items (
        id SERIAL PRIMARY KEY,
        partner_invoice_uuid VARCHAR(255) NOT NULL,
        ticket_uuid VARCHAR(255) NOT NULL,
        ticket_code VARCHAR(255) NULL,
        ticket_type_name VARCHAR(255) NULL,
        route_uuid VARCHAR(255) NULL,
        line_code VARCHAR(255) NULL,
        line_name VARCHAR(255) NULL,
        departure_harbor_name VARCHAR(255) NULL,
        arrival_harbor_name VARCHAR(255) NULL,
        departure VARCHAR(255) NULL,
        gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_partner_invoice_items_invoice
       ON partner_invoice_items (partner_invoice_uuid);`
    );
    console.log("partner_invoice_items table ready");

    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
