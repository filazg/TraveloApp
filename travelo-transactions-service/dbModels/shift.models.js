const { DataTypes } = require("sequelize");

// Smjene operatera s boat-deska. Boat-desk je autoritet (vodi smjenu lokalno
// jer mora raditi offline) i šalje state na backend best-effort. Backend služi
// kao read-store za portal/financije pregled — sve operacije su idempotentne
// po shift_uuid.
module.exports = (sequelize) => {
    const ShiftModel = sequelize.define(
        "shifts",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            shift_uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            client_uuid: { type: DataTypes.STRING, allowNull: true },
            client_name: { type: DataTypes.STRING, allowNull: true },
            client_oib: { type: DataTypes.STRING, allowNull: true },
            business_premise_uuid: { type: DataTypes.STRING, allowNull: true },
            business_premise_name: { type: DataTypes.STRING, allowNull: true },
            business_premise_fiscal_mark: { type: DataTypes.STRING, allowNull: true },
            billing_device_uuid: { type: DataTypes.STRING, allowNull: true },
            billing_device_fiscal_mark: { type: DataTypes.STRING, allowNull: true },
            operater_name: { type: DataTypes.STRING, allowNull: true },
            operater_surname: { type: DataTypes.STRING, allowNull: true },
            operater_username: { type: DataTypes.STRING, allowNull: false },
            shift_start: { type: DataTypes.DATE, allowNull: false },
            shift_end: { type: DataTypes.DATE, allowNull: true },
            shift_open: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            remark: { type: DataTypes.STRING, allowNull: true },
            shift_first_invoice: { type: DataTypes.STRING, allowNull: true },
            shift_last_invoice: { type: DataTypes.STRING, allowNull: true },
            shift_amount: { type: DataTypes.DECIMAL, allowNull: true },
            shift_vat_base: { type: DataTypes.DECIMAL, allowNull: true },
            shift_vat: { type: DataTypes.DECIMAL, allowNull: true },
            shift_harbor_tax: { type: DataTypes.DECIMAL, allowNull: true },
        },
        { freezeTableName: true, indexes: [{ fields: ["operater_username"] }, { fields: ["shift_start"] }] }
    );

    // Plaćanja po vrsti (gotovina / kartica) — agregirana vrijednost u trenutku
    // zatvaranja smjene. Postavlja se kad shift_open prelazi u false.
    const ShiftFinanceModel = sequelize.define(
        "shift_finance",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            shift_financ_uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            shift_uuid: { type: DataTypes.STRING, allowNull: false },
            payment_type_uuid: { type: DataTypes.STRING, allowNull: false },
            payment_type_name: { type: DataTypes.STRING, allowNull: true },
            payment_amount: { type: DataTypes.DECIMAL, allowNull: false },
        },
        { freezeTableName: true, indexes: [{ fields: ["shift_uuid"] }] }
    );

    return { ShiftModel, ShiftFinanceModel };
};
