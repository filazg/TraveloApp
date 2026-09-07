// ticket_validations — evidencija svih pokušaja validacije, uspješnih i ne.
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
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ticket_validations (
        id SERIAL PRIMARY KEY,
        ticket_uuid VARCHAR(255) NULL,
        ticket_code VARCHAR(255) NULL,
        scanned TEXT NULL,
        suffix VARCHAR(8) NULL,
        is_copy BOOLEAN NULL,
        copy_no INTEGER NULL,
        outcome VARCHAR(50) NOT NULL,
        is_conflict BOOLEAN NOT NULL DEFAULT false,
        conflict_reason VARCHAR(255) NULL,
        terminal_uuid VARCHAR(255) NULL,
        operator VARCHAR(255) NULL,
        validated_at TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_validations_ticket ON ticket_validations (ticket_uuid);`);
    // Pregled u portalu ide po vremenu, a sukobi se traže zasebno.
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_validations_time ON ticket_validations (validated_at DESC);`);
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_validations_conflict ON ticket_validations (validated_at DESC) WHERE is_conflict;`);
    console.log("ticket_validations: tablica i indeksi spremni");
  } catch (e) {
    console.error("migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
