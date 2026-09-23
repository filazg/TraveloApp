const { DataTypes } = require("sequelize");

// Popust po pravu na povlašteni prijevoz — postotak koji se primjenjuje kad se
// pravo utvrdi, a SEOP se ne može pitati.
//
// Online SEOP uz pravo vrati i postotak, pa se ovdje upisano ne koristi. Bez
// mreže postotka nema: čip nosi samo šifru prava (`BasicRight`), pa blagajna i
// mobilna popust moraju uzeti odnekud — odavde. Ured ga upisuje u portalu
// (Integracije → AKD → SEOP → Popusti).
//
// Jedan redak po šifri prava. Katalog prava drži akd servis (katalogPrava.js) i
// ovdje se namjerno ne prepisuje: redak postoji samo za pravo kojem je ured
// upisao postotak. Nepoznata šifra tako ne pada, nego ostaje bez popusta — što
// je i ispravno tumačenje, jer popust koji nitko nije odredio ne smije se
// izmisliti.
module.exports = (sequelize) => {
    const SeopRightDiscountModel = sequelize.define(
        "seop_right_discounts",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

            // Šifra prava iz kataloga SEOP-a, poglavlje 3. specifikacije v3.0
            // (npr. "02P", "03Ka", "09B").
            code: { type: DataTypes.STRING, allowNull: false, unique: true },

            // Postotak koji se offline primjenjuje na cijenu iz cjenika.
            // 0 znači „bez popusta" — cjenik vrijedi kakav jest.
            discount_pct: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

            // Naziv koji se ispisuje na karti umjesto šifre prava. Blagajniku i
            // putniku „03K" ne znači ništa, a puni opis iz Pravilnika je predug
            // za redak košarice i za papir — zato ured upisuje kratak naziv.
            // Prazno znači da se ponaša kao dosad (naziv iz cjenika).
            ticket_label: { type: DataTypes.STRING, allowNull: true },

            // Ugašeno pravo se ne šalje na uređaje. Služi da se popust povuče
            // bez brisanja upisanog postotka, kad ga treba vratiti.
            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

            // Tko je zadnji mijenjao — popust je novčana odluka, pa se u
            // Kontroli mora vidjeti čija je.
            updated_by: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, tableName: "seop_right_discounts", timestamps: true }
    );

    return { SeopRightDiscountModel };
};
