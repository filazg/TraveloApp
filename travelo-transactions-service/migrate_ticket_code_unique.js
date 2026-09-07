// Jedinstvenost broja karte.
//
// Broj karte je nasumican, a validacija i trazenje idu upravo po njemu — sudar
// bi znacio da kontrola nade krivu kartu. Dosad nista nije sprjecavalo dvije
// iste; s dvanaest znakova iz abecede od 32 (prostor 1,2 x 10^18) sudar je
// prakticki nemoguc, pa indeks nikad ne bi trebao okinuti.
//
// Stoji svejedno: bez njega bi se sudar ocitovao kao tiho pogresna karta na
// kontroli, a s njim kao glasna greska pri upisu. Glasno je bolje.
//
// Usporedba je bez razlike velikih i malih slova, jer se i trazenje radi tako
// (iLike). Ranije izdane karte imaju velika slova i mijesane oblike.
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

    // Prvo provjera: indeks se ne smije stvarati preko postojecih duplikata.
    const [dup] = await sequelize.query(
      `SELECT lower(ticket_code) AS k, count(*)::int AS n
       FROM tickets WHERE ticket_code IS NOT NULL
       GROUP BY 1 HAVING count(*) > 1`);
    if (dup.length) {
      console.error("postoje duplikati broja karte, indeks se ne stvara:");
      console.error(dup);
      process.exitCode = 1;
      return;
    }

    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_ticket_code
       ON tickets (lower(ticket_code))
       WHERE ticket_code IS NOT NULL;`);
    console.log("tickets: jedinstven broj karte osiguran (uq_tickets_ticket_code)");
  } catch (e) {
    console.error("migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
