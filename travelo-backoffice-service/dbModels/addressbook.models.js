const { DataTypes } = require("sequelize");

module.exports = (sequelize)=>{
    const AddressbookModel = sequelize.define(
        "addressbook",
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
            buyer_name:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_company_name:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_legal_id:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_vat_id:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_address:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_town:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_postal_code:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_country:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_email:{
                type:DataTypes.STRING,
                allowNull:true
            },
            buyer_is_active:{
                type:DataTypes.BOOLEAN,
                allowNull:true
            },
            f2_required:{
                type:DataTypes.BOOLEAN,
                allowNull:false,
                defaultValue:false
            }
        },
        { freezeTableName:true, tableName: "addressbook", timestamps: true }
    )
    return{
        AddressbookModel
    }
}