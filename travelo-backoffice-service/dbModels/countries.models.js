const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const CountriesModel = sequelize.define(
        "countries",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            code: {
                type: DataTypes.STRING(2),
                allowNull: false,
                unique: true,
            },
            name_hr: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            name_en: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        { freezeTableName: true, tableName: "countries", timestamps: true }
    );

    return { CountriesModel };
};
