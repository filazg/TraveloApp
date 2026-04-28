const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const OrdersModel = sequelize.define(
        "orders",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            uuid: { type: DataTypes.STRING, allowNull: false },

            // who made the sale
            partner_uuid: { type: DataTypes.STRING, allowNull: true },
            partner_name: { type: DataTypes.STRING, allowNull: true },
            partner_web_user_uuid: { type: DataTypes.STRING, allowNull: true },
            partner_web_user_username: { type: DataTypes.STRING, allowNull: true },

            // departure reference
            route_uuid: { type: DataTypes.STRING, allowNull: false },
            timetable_uuid: { type: DataTypes.STRING, allowNull: true },
            line_uuid: { type: DataTypes.STRING, allowNull: true },
            line_code: { type: DataTypes.STRING, allowNull: true },
            line_name: { type: DataTypes.STRING, allowNull: true },
            departure_harbor_code: { type: DataTypes.STRING, allowNull: true },
            departure_harbor_name: { type: DataTypes.STRING, allowNull: true },
            arrival_harbor_code: { type: DataTypes.STRING, allowNull: true },
            arrival_harbor_name: { type: DataTypes.STRING, allowNull: true },
            departure_date: { type: DataTypes.STRING, allowNull: true },
            departure_time: { type: DataTypes.STRING, allowNull: true },

            // line items
            items: { type: DataTypes.JSON, allowNull: false },
            total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

            // optional customer info
            customer_name: { type: DataTypes.STRING, allowNull: true },
            customer_email: { type: DataTypes.STRING, allowNull: true },
            customer_phone: { type: DataTypes.STRING, allowNull: true },

            note: { type: DataTypes.STRING, allowNull: true },
            status: { type: DataTypes.STRING, allowNull: false, defaultValue: "created" },
            channel: { type: DataTypes.STRING, allowNull: false, defaultValue: "partner_web" },
            payment_reference: { type: DataTypes.STRING, allowNull: true },
            language: { type: DataTypes.STRING, allowNull: true },
            payment_status_meta: { type: DataTypes.JSON, allowNull: true },
            buyer_data: { type: DataTypes.JSON, allowNull: true },
            invoice_uuid: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, tableName: "orders", timestamps: true }
    );
    return { OrdersModel };
};
