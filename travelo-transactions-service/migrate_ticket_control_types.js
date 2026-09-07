// Vrste sukoba na validacijama i oznake na ispisima kopija.
//
// Sukobi se dosad razlikovali samo tekstom razloga, a portal ih treba grupirati
// po karticama — zato vrsta ide u svoj stupac. Ispisi kopija dobivaju vlastitu
// oznaku jer se dvije vrste (previše kopija, kopiju izdao tuđi operater) vide
// već pri ispisu, ne tek na kontroli.
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
      `ALTER TABLE ticket_validations ADD COLUMN IF NOT EXISTS conflict_type VARCHAR(50) NULL;`);
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_validations_type
       ON ticket_validations (conflict_type, validated_at DESC)
       WHERE conflict_type IS NOT NULL;`);
    console.log("ticket_validations: conflict_type dodan");

    await sequelize.query(
      `ALTER TABLE ticket_copy_prints ADD COLUMN IF NOT EXISTS flag_type VARCHAR(50) NULL;`);
    await sequelize.query(
      `ALTER TABLE ticket_copy_prints ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(255) NULL;`);
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_copy_prints_flag
       ON ticket_copy_prints (flag_type, printed_at DESC)
       WHERE flag_type IS NOT NULL;`);
    console.log("ticket_copy_prints: flag_type i flag_reason dodani");
  } catch (e) {
    console.error("migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
