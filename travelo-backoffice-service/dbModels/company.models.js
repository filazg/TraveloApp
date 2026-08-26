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
          // Račun tvrtke — u SEPA nalogu je to IBAN platitelja, s njega odlaze
          // povrati. SWIFT nije obavezan (za domaća plaćanja banke ga ne traže),
          // ali ga neke aplikacije e-bankarstva žele vidjeti.
          iban:{
              type:DataTypes.STRING,
              allowNull:true
          },
          swift:{
              type:DataTypes.STRING,
              allowNull:true
          },
          bank_name:{
              type:DataTypes.STRING,
              allowNull:true
          },
          saop_organization_id:{
              type:DataTypes.STRING,
              allowNull:true
          },
          saop_link_to_book:{
              type:DataTypes.STRING,
              allowNull:true
          },
          saop_default_customer:{
              type:DataTypes.STRING,
              allowNull:true
          },
      },
      { freezeTableName:true, tableName: "company", timestamps: true }
    )
    return{
        CompanyModel
    }
}