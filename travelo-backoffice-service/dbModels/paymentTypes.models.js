const { DataTypes } = require("sequelize");

module.exports = (sequelize)=>{
    const PaymentTypesModel = sequelize.define(
        "payment_types",
        {
            id:{
                type:DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            name:{
                type:DataTypes.STRING,
                allowNull:false
            },
            acr:{
                type:DataTypes.STRING,
                allowNull:false
            },
            fiscalization:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            },
        },
        { freezeTableName:true, tableName: "payment_types", timestamps: true }
    )
    return {
        PaymentTypesModel
    }
}