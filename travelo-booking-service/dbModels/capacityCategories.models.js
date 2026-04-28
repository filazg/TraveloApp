const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const CapacityCategoryModel = sequelize.define(
        "capacity_categories",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            uuid: { type: DataTypes.STRING, allowNull: false, unique: true },
            code: { type: DataTypes.STRING, allowNull: false, unique: true },
            name_hr: { type: DataTypes.STRING, allowNull: false },
            name_en: { type: DataTypes.STRING, allowNull: false },
            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        },
        { freezeTableName: true, tableName: "capacity_categories", timestamps: true }
    );
    return { CapacityCategoryModel };
};
