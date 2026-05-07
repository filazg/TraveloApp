const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const AccountsModel = sequelize.define(
        "accounts",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            code: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        { freezeTableName: true, tableName: "accounts", timestamps: true }
    );

    const AccountMappingsModel = sequelize.define(
        "account_mappings",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // Logical key:
            //   "VAT" / "HARBOR_TAX" / "NET_REVENUE"  (organization-level)
            //   "PAYMENT:<payment_method_uuid>"      (per payment method)
            mapping_key: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            account_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // For payment methods: marks debit (cash/card register) vs credit
            // (rare). Defaults to "credit" for organisation-level keys.
            direction: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "credit",
            },
            note: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        { freezeTableName: true, tableName: "account_mappings", timestamps: true }
    );

    return { AccountsModel, AccountMappingsModel };
};
