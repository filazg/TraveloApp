const { DataTypes } = require("sequelize");

// Predložak po kojem se crta PDF karte, po prodajnom kanalu.
//
// Kanal je ovdje jer karta iz web prodaje i karta iz partnerske ne idu istom
// čovjeku: web kupac je putnik i dobiva je u pošti, partner je posrednik i
// najčešće je ispisuje. Zato svaki kanal bira svoj izgled.
//
// Jedan redak po kanalu. Kanal koji nema redak koristi zatečeni predložak, pa
// dodavanje novog kanala ne traži nikakav upis unaprijed.
module.exports = (sequelize) => {
    const TicketTemplatesModel = sequelize.define(
        "ticket_templates",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            // WEB | PARTNER | URED | POSL | MOBIL
            channel: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            // Ključ predloška iz helpers/ticketTemplates.js u transactions
            // servisu. Ime datoteke se ovdje NE sprema: predložak koji se
            // preimenuje ili makne ostavio bi neispravan zapis u bazi.
            template_key: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // Od koliko karata nadalje PDF dobiva sažetak kao prvu stranicu.
            // Nula znači nikad; jedan znači uvijek.
            summary_threshold: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 3,
            },
        },
        { freezeTableName: true, tableName: "ticket_templates", timestamps: true }
    );

    return { TicketTemplatesModel };
};
