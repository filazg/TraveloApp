const { DataTypes } = require("sequelize");

// Platni nalozi — evidencija povrata novca kupcu.
//
// Nalog je zbirka stavki: jedna stavka je jedan povrat. Povrati se okrupnjuju
// da se predaju odjednom — banci (SEPA) ili kartičarskoj kući (MONRI, OTP POS,
// 7pay). Zato nalog nosi `provider`: po njemu se zna kome ide i u kojem obliku
// se predaje.
//
// SEPA nalog nosi primatelja i IBAN, jer novac ide na račun koji upisuje
// operater. Kartični nalog ih ne treba — novac se vraća na karticu kojom je
// plaćeno, pa se umjesto toga pamti trag izvorne transakcije (terminal,
// autorizacijski kod, maskirani broj kartice) koji kartičarska kuća traži da
// bi povrat provela.
module.exports = (sequelize) => {
    const PaymentOrderModel = sequelize.define(
        "payment_orders",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            payment_order_uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            // SEPA | MONRI | OTP_POS | SEVENPAY — isti popis kao `card_provider`
            // u šifarniku sredstava plaćanja, uz SEPA za povrate na račun.
            provider: { type: DataTypes.STRING, allowNull: false, defaultValue: "SEPA" },
            name: { type: DataTypes.STRING, allowNull: false },
            status: { type: DataTypes.STRING, allowNull: false, defaultValue: "open" }, // open | closed
            created_by: { type: DataTypes.STRING, allowNull: true },
            closed_at: { type: DataTypes.DATE, allowNull: true },
            closed_by: { type: DataTypes.STRING, allowNull: true },
            note: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, indexes: [{ fields: ["status"] }, { fields: ["provider"] }] }
    );

    const PaymentOrderItemModel = sequelize.define(
        "payment_order_items",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            payment_item_uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            payment_order_uuid: { type: DataTypes.STRING, allowNull: false },
            provider: { type: DataTypes.STRING, allowNull: false, defaultValue: "SEPA" },
            // Iznos je uvijek pozitivan — to je ono što se kupcu vraća. Storno
            // račun isti iznos vodi kao negativan, pa se ne preuzima predznak.
            amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

            // — povrat na račun (SEPA) —
            recipient_name: { type: DataTypes.STRING, allowNull: true },
            recipient_iban: { type: DataTypes.STRING, allowNull: true },

            // — povrat na karticu — trag izvorne transakcije, čita se s računa
            // kojim je karta plaćena; operater ne upisuje ništa.
            card_mask: { type: DataTypes.STRING, allowNull: true },
            card_type: { type: DataTypes.STRING, allowNull: true },
            auth_code: { type: DataTypes.STRING, allowNull: true },
            terminal_id: { type: DataTypes.STRING, allowNull: true },
            transaction_reference: { type: DataTypes.STRING, allowNull: true },
            transaction_date: { type: DataTypes.STRING, allowNull: true },
            original_invoice_uuid: { type: DataTypes.STRING, allowNull: true },
            original_invoice_no: { type: DataTypes.STRING, allowNull: true },

            // — trag storna po kojem je povrat nastao —
            storno_invoice_uuid: { type: DataTypes.STRING, allowNull: true },
            storno_invoice_code: { type: DataTypes.STRING, allowNull: true },
            ticket_uuids: { type: DataTypes.TEXT, allowNull: true },
            ticket_codes: { type: DataTypes.TEXT, allowNull: true },
            description: { type: DataTypes.STRING, allowNull: true },
            created_by: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, indexes: [{ fields: ["payment_order_uuid"] }] }
    );

    return { PaymentOrderModel, PaymentOrderItemModel };
};
