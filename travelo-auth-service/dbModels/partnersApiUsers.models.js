const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const PartnersApiUsersModel = sequelize.define(
        "partners_api_users",
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
            partner_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            partner_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            partner_acr: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            otp: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            key: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
        },
        { freezeTableName: true, tableName: "partners_api_users", timestamps: true }
    );

    return { PartnersApiUsersModel };
};
