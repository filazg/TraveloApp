const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    CompanyModel = sequelize.define(
      "company",
      {
          id: {
              type: DataTypes.UUID,
              primaryKey: true,
              defaultValue: DataTypes.UUIDV4,
          },
          name: {
              type: DataTypes.STRING,
              allowNull: false,
          },
          acr:{
              type:DataTypes.STRING,
              allowNull:true
          },
          additional_name:{
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
          legal_id:{
              type:DataTypes.STRING,
              allowNull:true
          },
          vat_id:{
              type:DataTypes.STRING,
              allowNull:true
          },
          is_active:{
              type:DataTypes.BOOLEAN,
              allowNull:true
          },
      },
      { freezeTableName:true, tableName: "company", timestamps: true }
    )
    return{
        CompanyModel
    }
}