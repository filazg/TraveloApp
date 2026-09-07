const { DataTypes } = require("sequelize");

// Evidencija ispisa kopija karata.
//
// Kopija se od originala razlikuje po tri znaka uz broj karte (vidi
// helpers/ticketCopyMark.js), ali sam papir ne kaže tko ju je i kada izdao.
// Zato svaki ispis ostavlja zapis: bez njega se zloupotreba vidi tek kad se
// kopija i original pojave na kontroli, a ne zna se odakle je kopija došla.
//
// Redak nastaje po ispisu, ne po karti — ista karta zna imati više kopija.
module.exports = (sequelize) => {
    const TicketCopyPrintModel = sequelize.define(
        "ticket_copy_prints",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            ticket_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            ticket_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Redni broj kopije te karte, počevši od 1. Zapisan je i u sufiksu
            // na papiru, pa se otisnuta kopija može vezati uz ovaj redak.
            copy_no: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            // Tri znaka koja su otisnuta uz broj karte na toj kopiji.
            suffix: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            printed_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            operator_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            operator_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            billing_device_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            billing_device_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            business_premise_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Odakle je kopija ispisana: "desk", "mobile", "portal"…
            origin: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Oznaka sumnje utvrđena već pri ispisu — previše kopija iste karte
            // ili kopija s druge blagajne nego što je karta prodana. Vrste su u
            // helpers/ticketControlTypes.js.
            flag_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            flag_reason: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        { freezeTableName: true, tableName: "ticket_copy_prints", timestamps: true }
    );

    return { TicketCopyPrintModel };
};
