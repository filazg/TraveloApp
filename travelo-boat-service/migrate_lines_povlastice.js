// Prihvacanje povlastenih kartica po liniji — SEOP (otocne) i MOSI (invalidske).
//
// Ista polja idu i u sales bazu, jer se linije onamo prepisuju u cijelosti i
// blagajna ih cita odande. Pokrece se jednom; idempotentno.
const { Sequelize } = require("sequelize");

const baze = ["travelo-boat-db", "travelo-sales-db"];

const stupci = `
  ALTER TABLE lines ADD COLUMN IF NOT EXISTS seop_mode VARCHAR(20) NOT NULL DEFAULT 'ne';
  ALTER TABLE lines ADD COLUMN IF NOT EXISTS mosi_accepted BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE lines ADD COLUMN IF NOT EXISTS mosi_discount_pct INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE lines ADD COLUMN IF NOT EXISTS mosi_companion_free BOOLEAN NOT NULL DEFAULT true;
`;

(async () => {
  for (const ime of baze) {
    const sequelize = new Sequelize(ime, "doadmin", process.env.DB_PASS, {
      host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
      port: 25060,
      dialect: "postgres",
      dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
      logging: false,
    });
    try {
      await sequelize.authenticate();
      await sequelize.query(stupci);
      console.log(ime, "— stupci spremni.");
    } catch (error) {
      console.log(ime, "— migracija nije prosla:", error?.message || error);
      process.exitCode = 1;
    } finally {
      await sequelize.close();
    }
  }
})();
