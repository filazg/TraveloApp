// electron/db/index.cjs
const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { Sequelize } = require("sequelize");

const dbPath = path.join(app.getPath("userData"), "travelo.sqlite");

// Baza je do 1.0.20 stajala na "./travelo.sqlite" — relativno prema radnom
// direktoriju procesa, što je kod instalirane blagajne sam instalacijski
// direktorij. NSIS ga pri nadogradnji očisti, pa je svaka nova verzija odnosila
// bazu, a s njom i brojače računa. Zato baza sada živi u userData, koji
// instalacija ne dira.
//
// Zatečena baza se preseli pri prvom pokretanju. Kopira se, ne premješta, da
// original ostane kao sigurnosna kopija dok se ne potvrdi da je sve na broju.
const legacyPath = path.resolve("./travelo.sqlite");
if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath)) {
    try {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.copyFileSync(legacyPath, dbPath);
        console.log("DB preseljena:", legacyPath, "->", dbPath);
    } catch (error) {
        // Ako preseljenje ne uspije, bolje je nastaviti sa starom lokacijom nego
        // se dignuti s praznom bazom i početi izdavati račune od broja 1.
        console.log("DB preseljenje nije uspjelo:", error?.message || error);
    }
}

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: fs.existsSync(dbPath) ? dbPath : (fs.existsSync(legacyPath) ? legacyPath : dbPath),
  logging: false
});

module.exports = {
  sequelize
};
