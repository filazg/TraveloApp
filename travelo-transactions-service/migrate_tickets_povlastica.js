const { Sequelize } = require("sequelize");

// Dopuna SEOP polja na karti — ono što dojava prodaje traži, a nastaje na
// blagajni: koji je identifikator upotrijebljen, zapečaćeni zapis provjere,
// redovna cijena prije popusta, namjena, odobrenje za virtualnu iskaznicu te
// oznake „prodano bez potvrđenog prava", „provjera offline" i „karta pratnje".
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
  const stupci = [
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_sustav VARCHAR(8);`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_id_vrsta VARCHAR(16);`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_token TEXT;`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_namjena VARCHAR(16);`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_redovna_cijena NUMERIC(10,2);`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_odobrenje VARCHAR(64);`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_uvijek_prodaj BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_offline BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_pratnja BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seop_dojava BOOLEAN DEFAULT TRUE;`,
  ];
  try {
    await sequelize.authenticate();
    for (const upit of stupci) await sequelize.query(upit);
    console.log("tickets: polja povlastice dodana");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
