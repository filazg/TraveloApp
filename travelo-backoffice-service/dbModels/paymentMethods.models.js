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
            // Tko provodi kartičnu transakciju za ovo sredstvo plaćanja. Prodajni
            // kanal po ovome zna smije li ga uopće ponuditi i koji uređaj/servis
            // pokreće: MONRI (web), OTP_POS (serijski terminal na blagajni),
            // SEVENPAY. Prazno = kartično bez integracije (ručni imprinter,
            // vanjski terminal), transakcija se ne pokreće iz aplikacije.
            card_provider:{
                type:DataTypes.STRING,
                allowNull:true
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