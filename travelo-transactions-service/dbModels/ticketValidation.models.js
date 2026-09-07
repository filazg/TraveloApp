const { DataTypes } = require("sequelize");

// Evidencija pokušaja validacije karata.
//
// Karta je dosad nosila samo `validate_data` — trenutak kad je prošla. Tko je
// pokušao pa ne uspio, i je li skenirana kopija ili original, nije se vidjelo
// nigdje. Zato ovdje ide SVAKI pokušaj, i uspješan i neuspješan.
//
// Bez neuspješnih se zloupotreba ne da uhvatiti: drugi pokušaj s kopijom je
// upravo onaj koji ne uspije, pa bi ispao nevidljiv.
module.exports = (sequelize) => {
    const TicketValidationModel = sequelize.define(
        "ticket_validations",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            // Prazno kad karta nije nađena — skeniran je kod koji ne postoji.
            ticket_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ticket_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Doslovno ono što je skener pročitao. Čuva se neobrađeno: kad kod
            // ne odgovara nijednoj karti, ovo je jedini trag što je bilo na papiru.
            scanned: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            // Tri znaka pročitana iz koda i što iz njih slijedi.
            suffix: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            is_copy: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
            },
            copy_no: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            // validated | already_validated | canceled | inactive | not_found | error
            outcome: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // Je li pokušaj u sukobu s ranijom validacijom iste karte — kopija
            // preko originala ili obrnuto. To je ono zbog čega evidencija postoji.
            is_conflict: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            conflict_reason: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Vrsta sukoba iz helpers/ticketControlTypes.js. Portal po njoj
            // slaže kartice, pa razlog ostaje slobodan tekst za ljude.
            conflict_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            terminal_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            operator: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Trenutak s uređaja. Uređaj validira i bez mreže, pa zna stići
            // satima kasnije — vrijedi vrijeme ukrcaja, ne trenutak javljanja.
            validated_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        { freezeTableName: true, tableName: "ticket_validations", timestamps: true }
    );

    return { TicketValidationModel };
};
