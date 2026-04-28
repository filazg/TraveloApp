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
    console.log("connected");

    await sequelize.query(
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_fiskal_no INTEGER NULL;`
    );
    console.log("added invoice_fiskal_no (INTEGER NULL)");

    const [{ cnt }] = await sequelize.query(
      `SELECT COUNT(*)::int AS cnt FROM invoices WHERE invoice_no IS NULL;`,
      { type: QueryTypes.SELECT }
    );
    console.log(`rows with invoice_no IS NULL: ${cnt}`);

    if (cnt === 0) {
      await sequelize.query(
        `ALTER TABLE invoices ALTER COLUMN invoice_no SET NOT NULL;`
      );
      console.log("invoice_no -> NOT NULL");
    } else {
      console.warn(
        `SKIPPED setting invoice_no NOT NULL — ${cnt} NULL rows present. Fix data, then ALTER manually.`
      );
    }

    console.log("DONE");
  } catch (err) {
    console.error("MIGRATION FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
