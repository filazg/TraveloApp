// ticket_validations.validated_route_uuid i other_voyage — na kojem je polasku
// karta ocitana i je li pripadala nekom drugom.
//
// Bez toga se karta propustena s drugog polaska nigdje ne vidi: brojac na
// kapetanskom modulu broji karte te voznje, a takva karta nije njegova.
//
// Pokretanje: node travelo-transactions-service/migrate_validation_route.js
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
      `ALTER TABLE ticket_validations ADD COLUMN IF NOT EXISTS validated_route_uuid VARCHAR(64) NULL;`);
    await sequelize.query(
      `ALTER TABLE ticket_validations ADD COLUMN IF NOT EXISTS other_voyage BOOLEAN NOT NULL DEFAULT false;`);
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_validations_route
         ON ticket_validations (validated_route_uuid, validated_at DESC);`);
    console.log("ticket_validations: validated_route_uuid i other_voyage spremni");
  } catch (e) {
    console.error("migracija nije prosla:", e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
