const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>{
    const TerminalsModel = sequelize.define(
        "terminals",
        {
            id:{
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            uuid: {
                type: DataTypes.STRING,
                allowNull: false
            },
            tid : {
                type: DataTypes.STRING,
                allowNull: true
            },
            otp : {
                type: DataTypes.STRING,
                allowNull: true
            },
            serial_number: {
                type: DataTypes.STRING,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: true
            }
        },
        { freezeTableName:true, tableName: "terminals", timestamps: true } 
    )
    return {
        TerminalsModel
    }
}