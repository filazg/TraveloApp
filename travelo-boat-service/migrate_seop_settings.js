// seop_settings — postavke veze prema SEOP-u i odluka o tome što se šalje.
// Jedan redak, id = 1. Idempotentno.
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
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS seop_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        environment VARCHAR(10) NOT NULL DEFAULT 'mock',
        brodarev_oib VARCHAR(20),
        lozinka VARCHAR(255),
        enabled BOOLEAN NOT NULL DEFAULT false,
        send_opk BOOLEAN NOT NULL DEFAULT true,
        send_ppk BOOLEAN NOT NULL DEFAULT true,
        send_cvikanje BOOLEAN NOT NULL DEFAULT true,
        send_storno BOOLEAN NOT NULL DEFAULT true,
        send_isplovljenje BOOLEAN NOT NULL DEFAULT false,
        send_ponisti_cvikanje BOOLEAN NOT NULL DEFAULT false,
        send_from_date DATE,
        ozn_pristup_tocke_source VARCHAR(30) NOT NULL DEFAULT 'billing_device',
        ozn_pristup_tocke_fixed VARCHAR(50),
        line_no_source VARCHAR(30) NOT NULL DEFAULT 'line_code',
        jop_source VARCHAR(30) NOT NULL DEFAULT 'departure_uuid',
        p12_file VARCHAR(255),
        p12_password VARCHAR(255),
        p12_subject VARCHAR(255),
        p12_valid_to TIMESTAMPTZ,
        p12_uploaded_at TIMESTAMPTZ,
        ca_file VARCHAR(255),
        sign_cert_file VARCHAR(255),
        tls_reject_unauthorized BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    // Redak mora postojati da ekran u portalu ima što prikazati prije prvog
    // spremanja.
    await sequelize.query(`
      INSERT INTO seop_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);
    console.log("seop_settings spremna.");
  } catch (error) {
    console.log("migracija nije prosla:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
