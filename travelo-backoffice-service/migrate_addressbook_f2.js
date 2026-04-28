const { Sequelize } = require("sequelize");
const dbConfig = {
  db_name: "travelo-backoffice-db",
  db_username: "doadmin",
  db_pass: process.env.DB_PASS,
  db_port: 25060,
  db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};
(async () => {
  const s = new Sequelize(dbConfig.db_name, dbConfig.db_username, dbConfig.db_pass, {
    host: dbConfig.db_host, port: dbConfig.db_port, dialect: "postgres",
    dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
    logging: false,
  });
  try {
    await s.authenticate();
    await s.query(`ALTER TABLE addressbook ADD COLUMN IF NOT EXISTS f2_required BOOLEAN NOT NULL DEFAULT false;`);
    console.log("addressbook.f2_required added");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await s.close();
  }
})();
