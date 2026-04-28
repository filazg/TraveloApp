const { Sequelize, QueryTypes } = require("sequelize");
const countries = require("./dbModels/countries.seed");

const dbConfig = {
  db_name: "travelo-backoffice-db",
  db_username: "doadmin",
  db_pass: process.env.DB_PASS,
  db_port: 25060,
  db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};

// Build lookup: lowercase name or code → ISO code
const lookup = {};
for (const [code, name_hr, name_en] of countries) {
  lookup[code.toLowerCase()] = code;
  lookup[name_hr.toLowerCase()] = code;
  lookup[name_en.toLowerCase()] = code;
}
// Extra aliases for common free-text values
const aliases = {
  "hrvatska": "HR",
  "croatia": "HR",
  "hr": "HR",
  "italija": "IT",
  "italy": "IT",
  "njemacka": "DE",
  "njemačka": "DE",
  "germany": "DE",
  "slovenija": "SI",
  "slovenia": "SI",
  "srbija": "RS",
  "serbia": "RS",
  "austrija": "AT",
  "austria": "AT",
};
Object.assign(lookup, aliases);

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

    const rows = await sequelize.query(
      `SELECT id, partner_name, partner_country FROM partners WHERE partner_country IS NOT NULL AND partner_country <> '';`,
      { type: QueryTypes.SELECT }
    );
    console.log(`partners with partner_country set: ${rows.length}`);

    let converted = 0;
    const unresolved = [];
    for (const r of rows) {
      const raw = (r.partner_country || "").trim();
      if (!raw) continue;
      // already ISO-2?
      if (raw.length === 2 && lookup[raw.toLowerCase()] === raw.toUpperCase()) continue;
      const code = lookup[raw.toLowerCase()];
      if (code) {
        await sequelize.query(
          `UPDATE partners SET partner_country = :code WHERE id = :id;`,
          { replacements: { code, id: r.id } }
        );
        console.log(`  partner ${r.id} "${r.partner_name}": "${raw}" -> ${code}`);
        converted++;
      } else {
        unresolved.push(r);
      }
    }
    console.log(`converted: ${converted}`);
    if (unresolved.length) {
      console.log(`UNRESOLVED (${unresolved.length}) — ručno postavi u portalu:`);
      unresolved.forEach((r) => console.log(`  id=${r.id} "${r.partner_name}" partner_country="${r.partner_country}"`));
    }

    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
