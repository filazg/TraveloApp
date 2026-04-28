const { DataTypes } = require("sequelize");


module.exports =  (sequelize) =>{
  const BusinessPremisesModel =  sequelize.define(
    "business_premises",
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
        type_uuid:{
            type:DataTypes.STRING,
            allowNull:true
        },
        type:{
            type:DataTypes.STRING,
            allowNull:false
        },
        address:{
            type:DataTypes.STRING,
            allowNull:true
        },
        postal_code:{
            type:DataTypes.STRING,
            allowNull:true
        },
        town:{
            type:DataTypes.STRING,
            allowNull:true
        },
        country:{
            type:DataTypes.STRING,
            allowNull:true
        },
        description:{
            type:DataTypes.STRING,
            allowNull:true
        },
        fiskal_mark:{
            type:DataTypes.STRING,
            allowNull:true
        },
        working_time:{
            type:DataTypes.STRING,
            allowNull:true
        },    
        bp_own:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_uuid:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_name:{
            type:DataTypes.STRING,
            allowNull:true
        },
        is_active:{
            type:DataTypes.BOOLEAN,
            allowNull:true
        },
    },
    { freezeTableName:true, tableName: "business_premises", timestamps: true }
  );
  return{
        BusinessPremisesModel
    }
}