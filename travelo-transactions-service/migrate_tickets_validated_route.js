// Polazak na kojem je karta ocitana.
//
// Putnik koji propusti brod ude na sljedeci sa starom kartom. Do sada je takva
// karta na svom polasku izgledala kao obican ukrcaj — kapetan ju je brojao kao
// da je covjek kod njega, a covjek je bio na drugom brodu.
//
// Postojeci zapisi se popunjavaju iz evidencije ocitanja (ticket_validations),
// pa i dosadasnje validacije dobiju tocan polazak.
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
    await sequelize.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS validated_route_uuid VARCHAR(255);`
    );
    // Zatecene validirane karte: uzima se prvo uspjesno ocitanje.
    const [rezultat] = await sequelize.query(`
      UPDATE tickets t
      SET validated_route_uuid = v.validated_route_uuid
      FROM (
        SELECT DISTINCT ON (ticket_uuid) ticket_uuid, validated_route_uuid
        FROM ticket_validations
        WHERE outcome = 'validated' AND validated_route_uuid IS NOT NULL
        ORDER BY ticket_uuid, validated_at ASC
      ) v
      WHERE t.ticket_uuid = v.ticket_uuid
        AND t.validated_route_uuid IS NULL;
    `);
    console.log("tickets: validated_route_uuid dodan i popunjen iz evidencije ocitanja");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
