const { Sequelize, QueryTypes } = require("sequelize");

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

    const rows = await sequelize.query(
      `SELECT id, invoice_uuid, invoice_no, invoice_code, invoice_year, invoice_date,
              invoice_status, invoice_canceled, invoice_amount, "invoice_JIR", "invoice_ZKI",
              "createdAt"
       FROM invoices
       WHERE invoice_no IS NULL
       ORDER BY "createdAt" ASC;`,
      { type: QueryTypes.SELECT }
    );
    console.log(`NULL invoice_no rows: ${rows.length}`);
    console.table(rows);

    const years = await sequelize.query(
      `SELECT invoice_year, COUNT(*)::int AS cnt, MAX(invoice_no) AS max_no, MIN(invoice_no) AS min_no
       FROM invoices
       WHERE invoice_no IS NOT NULL
       GROUP BY invoice_year
       ORDER BY invoice_year;`,
      { type: QueryTypes.SELECT }
    );
    console.log("\nExisting invoice_no ranges per year:");
    console.table(years);
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
