const { DataTypes } = require("sequelize");

module.exports = (sequelize)=>{
    const PaymentMethodsModel = sequelize.define(
        "payment_methods",
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
            is_card_payment:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            },
            payment_type_uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            payment_type_acr:{
                type:DataTypes.STRING,
                allowNull:false
            },
            fiscalization:{
                type:DataTypes.BOOLEAN,
                allowNull:true
            },
        },
         { freezeTableName:true, tableName: "payment_methods", timestamps: true }
    )
    return {
        PaymentMethodsModel
    }
}