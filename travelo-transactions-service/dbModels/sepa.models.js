const { DataTypes } = require("sequelize");

// SEPA nalozi — povrat novca na račun umjesto u gotovini.
//
// Nalog je zbirka stavki: jedna stavka je jedan povrat jednom primatelju.
// Zato se više storna može okrupniti u isti nalog i banci predati odjednom.
// Dok je nalog otvoren, u njega se dodaju stavke; zatvaranjem se zaključava i
// više se ne mijenja (na zatvoreni se nalog ne smije dodavati jer je već
// predan banci).
module.exports = (sequelize) => {
    const SepaOrderModel = sequelize.define(
        "sepa_orders",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            sepa_order_uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            // Naziv naloga zadaje operater — jedino što se upisuje pri otvaranju.
            name: { type: DataTypes.STRING, allowNull: false },
            status: { type: DataTypes.STRING, allowNull: false, defaultValue: "open" }, // open | closed
            created_by: { type: DataTypes.STRING, allowNull: true },
            closed_at: { type: DataTypes.DATE, allowNull: true },
            closed_by: { type: DataTypes.STRING, allowNull: true },
            note: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, indexes: [{ fields: ["status"] }] }
    );

    const SepaOrderItemModel = sequelize.define(
        "sepa_order_items",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            sepa_item_uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            sepa_order_uuid: { type: DataTypes.STRING, allowNull: false },
            recipient_name: { type: DataTypes.STRING, allowNull: false },
            recipient_iban: { type: DataTypes.STRING, allowNull: false },
            // Iznos je uvijek pozitivan — to je ono što se primatelju isplaćuje.
            // Storno račun isti iznos vodi kao negativan, pa se ne preuzima
            // predznak nego apsolutna vrijednost.
            amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
            // Trag odakle povrat dolazi: storno račun i karte koje su njime
            // stornirane. Karte se pišu kao popis odvojen zarezom, jer se u
            // jednu stavku može spojiti više karata s istog računa.
            storno_invoice_uuid: { type: DataTypes.STRING, allowNull: true },
            storno_invoice_code: { type: DataTypes.STRING, allowNull: true },
            ticket_uuids: { type: DataTypes.TEXT, allowNull: true },
            ticket_codes: { type: DataTypes.TEXT, allowNull: true },
            description: { type: DataTypes.STRING, allowNull: true },
            created_by: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, indexes: [{ fields: ["sepa_order_uuid"] }] }
    );

    return { SepaOrderModel, SepaOrderItemModel };
};
