const { Sequelize } = require("sequelize");

const dbConfig = {
  db_name: "travelo-backoffice-db",
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
        WHERE table_name = 'payment_methods' AND column_name = 'paid_at_issue') AS postoji;`
    );
    await sequelize.query(`ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS paid_at_issue BOOLEAN NOT NULL DEFAULT true;`);
    console.log("payment_methods.paid_at_issue added (default true)");
    // Virman (tip T) se placa nakon izdavanja. Samo pri prvom dodavanju
    // stupca — ponovno pokretanje ne smije pregaziti ono sto je postavljeno u portalu.
    if (!postoji) {
      const [, r] = await sequelize.query(`UPDATE payment_methods SET paid_at_issue = false WHERE payment_type_acr = 'T';`);
      console.log(`virman (T) -> paid_at_issue=false: ${r?.rowCount ?? '?'} redaka`);
    }
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
