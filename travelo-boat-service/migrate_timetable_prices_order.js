// Redoslijed vrsta karata na plovidbenom redu (Task #653). Portal ga zadaje
// strelicama u cijenama, a prodajna sucelja (desk, mobilna, web, partneri)
// po njemu slazu vrste karata.
//
// Postojeci redovi dobivaju poredak kakav su dosad imali u prodaji: redom
// kojim su cijene spremljene (najmanji id po vrsti karte).
//
//   DB_PASS=... node migrate_timetable_prices_order.js
const { Sequelize } = require("sequelize");

const dbConfig = {
  db_name: "travelo-boat-db",
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
    console.log("timetable_prices: ticket_type_order added");
    const [, meta] = await sequelize.query(`
      UPDATE timetable_prices tp
         SET ticket_type_order = r.rn
        FROM (
          SELECT timetable_uuid, ticket_type_uuid,
                 (ROW_NUMBER() OVER (PARTITION BY timetable_uuid ORDER BY MIN(id))) - 1 AS rn
            FROM timetable_prices
           WHERE is_active = true
           GROUP BY timetable_uuid, ticket_type_uuid
        ) r
       WHERE tp.timetable_uuid = r.timetable_uuid
         AND tp.ticket_type_uuid = r.ticket_type_uuid
         AND tp.ticket_type_order IS NULL;`);
    console.log("timetable_prices: poredak upisan za postojece cijene:", meta?.rowCount ?? "?");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
