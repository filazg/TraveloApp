const { Sequelize, QueryTypes } = require("sequelize");
const dbConfig = {
  db_name: "travelo-transactions-db",
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
    const rows = await s.query(
      `SELECT id, ticket_code, departure_planed, departure, line_code, departure_harbor_id, arrival_harbor_id, status, partner_uuid, "createdAt"
       FROM tickets ORDER BY id DESC LIMIT 20;`,
      { type: QueryTypes.SELECT }
    );
    console.table(rows);
    const [{ cnt }] = await s.query(`SELECT COUNT(*)::int AS cnt FROM tickets;`, { type: QueryTypes.SELECT });
    console.log(`total tickets: ${cnt}`);
  } catch (err) {
    console.error(err.message);
  } finally {
    await s.close();
  }
})();
