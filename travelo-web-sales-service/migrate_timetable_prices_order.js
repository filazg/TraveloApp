// Redoslijed vrsta karata na plovidbenom redu (Task #653) — kopija u web
// prodaji. Vrijednosti stizu iz boat servisa pri sinkronizaciji plovidbenog
// reda (pri pokretanju servisa se povuku svi), pa se ovdje dodaje samo stupac.
//
//   DB_PASS=... node migrate_timetable_prices_order.js
const { Sequelize } = require("sequelize");

const dbConfig = {
  db_name: "travelo-web-sales-db",
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
    await sequelize.query(`ALTER TABLE timetable_prices ADD COLUMN IF NOT EXISTS ticket_type_order INTEGER;`);
    console.log("web-sales timetable_prices: ticket_type_order added");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
