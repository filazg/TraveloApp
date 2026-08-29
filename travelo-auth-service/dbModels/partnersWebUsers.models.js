const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const PartnersWebUsersModel = sequelize.define(
        "partners_web_users",
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
            username: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            password: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // Preslika iz backofficea; po njoj partnerska prodaja odlucuje sto
            // korisniku uopce prikazuje.
            roles: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'SALES',
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
        },
        { freezeTableName: true, tableName: "partners_web_users", timestamps: true }
    );

    return { PartnersWebUsersModel };
};
