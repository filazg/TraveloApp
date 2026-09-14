// Dvije odluke po liniji koje se dosad nisu dale postaviti:
//
//   seop_report_sales   — dojavljuje li se prodaja SEOP-u. Iskljuceno znaci da
//                         se SEOP koristi samo za provjeru iskaznice, a karta se
//                         izdaje i ostaje izvan SEOP obracuna.
//   seop_apply_discount — primjenjuje li se postotak popusta sa SEOP-a na
//                         otocnu cijenu iz cjenika, ili je ta cijena vec konacna.
//
// Ista polja idu i u sales bazu, jer se linije onamo prepisuju u cijelosti i
// blagajna ih cita odande. Pokrece se jednom; idempotentno.
const { Sequelize } = require("sequelize");

const baze = ["travelo-boat-db", "travelo-sales-db"];

const stupci = `
  ALTER TABLE lines ADD COLUMN IF NOT EXISTS seop_report_sales BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE lines ADD COLUMN IF NOT EXISTS seop_apply_discount BOOLEAN NOT NULL DEFAULT false;
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
