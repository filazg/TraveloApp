const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const TicketTypeMappingModel = sequelize.define(
        "ticket_type_mappings",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            ticket_type_uuid: { type: DataTypes.STRING, allowNull: false },
            ticket_type_name: { type: DataTypes.STRING, allowNull: true },
            category_uuid: { type: DataTypes.STRING, allowNull: false },
            category_code: { type: DataTypes.STRING, allowNull: true },
            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        },
        { freezeTableName: true, tableName: "ticket_type_mappings", timestamps: true }
    );
    return { TicketTypeMappingModel };
};
