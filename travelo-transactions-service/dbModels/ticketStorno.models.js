const { DataTypes } = require("sequelize");

// Evidencija storna po karti — Kontrola → „Storniranje".
//
// Jedan redak je jedna karta, bez obzira je li stornirana sama ili sa svojim
// računom. Uz storno se pamti i odbijeni pokušaj storna validirane karte
// (outcome = odbijeno_validirana): karta nije stornirana, ali Kontrola mora
// vidjeti da je netko pokušao vratiti novac za vožnju koja je već pružena.
//
// Vrijeme polaska (`polazak`) je ono po kojem je uređaj mjerio rok za storno —
// kod pomaknutog polaska to je novo vrijeme — a razvrstavanje se računa pri
// upisu i čuva, da se kasnija promjena plovidbenog reda ne odrazi na stare
// zapise.
module.exports = (sequelize) => {
    const TicketStornoModel = sequelize.define(
        "ticket_stornos",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            uuid: { type: DataTypes.STRING, allowNull: true },

            // storno | odbijeno_validirana
            outcome: { type: DataTypes.STRING, allowNull: false, defaultValue: "storno" },
            // desk | mobile | portal | druga_blagajna
            source: { type: DataTypes.STRING, allowNull: true },

            ticket_uuid: { type: DataTypes.STRING, allowNull: true },
            ticket_code: { type: DataTypes.STRING, allowNull: true },
            ticket_type_name: { type: DataTypes.STRING, allowNull: true },
            ticket_price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
            invoice_uuid: { type: DataTypes.STRING, allowNull: true },

            storno_invoice_uuid: { type: DataTypes.STRING, allowNull: true },
            storno_invoice_code: { type: DataTypes.STRING, allowNull: true },
            percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
            refund_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

            line_code: { type: DataTypes.STRING, allowNull: true },
            line_name: { type: DataTypes.STRING, allowNull: true },
            departure_harbor_name: { type: DataTypes.STRING, allowNull: true },
            arrival_harbor_name: { type: DataTypes.STRING, allowNull: true },
            route_uuid: { type: DataTypes.STRING, allowNull: true },
            departure_planed: { type: DataTypes.STRING, allowNull: true },
            polazak: { type: DataTypes.STRING, allowNull: true },

            // Trenutak storna s uređaja (uređaj radi i offline).
            storno_at: { type: DataTypes.DATE, allowNull: false },
            // Minute od polaska do storna; negativno = prije polaska.
            minutes_after_departure: { type: DataTypes.INTEGER, allowNull: true },
            // prije_polaska | u_roku | nakon_roka | nepoznato
            kategorija: { type: DataTypes.STRING, allowNull: false, defaultValue: "nepoznato" },
            // Validacija očitanjem (ticket_validations), ne automatska pri prodaji.
            validated_at: { type: DataTypes.DATE, allowNull: true },
            // Je li uređaj imao uključeno „Slobodno storniranje".
            slobodno_storniranje: { type: DataTypes.BOOLEAN, allowNull: true },

            terminal_uuid: { type: DataTypes.STRING, allowNull: true },
            terminal_tid: { type: DataTypes.STRING, allowNull: true },
            terminal_name: { type: DataTypes.STRING, allowNull: true },
            operator: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, tableName: "ticket_stornos", timestamps: true }
    );

    return { TicketStornoModel };
};
