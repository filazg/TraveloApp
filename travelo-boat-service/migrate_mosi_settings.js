// mosi_settings — postavke veze prema MOSI-ju (AKD). Jedan redak, id = 1.
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
      CREATE TABLE IF NOT EXISTS mosi_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        environment VARCHAR(10) NOT NULL DEFAULT 'mock',
        api_key_test VARCHAR(255),
        api_key_prod VARCHAR(255),
        oib_pu VARCHAR(20),
        id_osoba_pu VARCHAR(50),
        enabled BOOLEAN NOT NULL DEFAULT false,
        send_utrosak BOOLEAN NOT NULL DEFAULT true,
        send_storno BOOLEAN NOT NULL DEFAULT true,
        send_from_date DATE,
        sync_crna_lista BOOLEAN NOT NULL DEFAULT false,
        crna_lista_zadnji_dohvat TIMESTAMPTZ,
        p12_file VARCHAR(255),
        p12_password VARCHAR(255),
        p12_subject VARCHAR(255),
        p12_valid_to TIMESTAMPTZ,
        p12_uploaded_at TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await sequelize.query(`
      INSERT INTO mosi_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);
    console.log("mosi_settings spremna.");
  } catch (error) {
    console.log("migracija nije prosla:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
