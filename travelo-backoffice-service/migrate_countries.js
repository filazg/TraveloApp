const { Sequelize, QueryTypes } = require("sequelize");
const countries = require("./dbModels/countries.seed");

const dbConfig = {
  db_name: "travelo-backoffice-db",
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
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        code VARCHAR(2) NOT NULL UNIQUE,
        name_hr VARCHAR(255) NOT NULL,
        name_en VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("countries table ready");

    let inserted = 0;
    let updated = 0;
    for (const [code, name_hr, name_en] of countries) {
      const [result] = await sequelize.query(
        `INSERT INTO countries (code, name_hr, name_en, is_active, "createdAt", "updatedAt")
         VALUES (:code, :name_hr, :name_en, true, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE
           SET name_hr = EXCLUDED.name_hr,
               name_en = EXCLUDED.name_en,
               "updatedAt" = NOW()
         RETURNING (xmax = 0) AS inserted;`,
        { replacements: { code, name_hr, name_en }, type: QueryTypes.SELECT }
      );
      if (result?.inserted) inserted++; else updated++;
    }
    console.log(`seed: ${inserted} new, ${updated} updated, ${countries.length} total`);

    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
