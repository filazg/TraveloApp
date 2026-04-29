const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const ApiOrdersModel = sequelize.define(
        "api_orders",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            order_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            partner_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            api_user_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            order_number: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            total_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            order_items: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "DRAFT",
            },
            confirmed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            canceled_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        { freezeTableName: true, tableName: "api_orders", timestamps: true }
    );

    return { ApiOrdersModel };
};
