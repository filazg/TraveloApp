const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const RegionsModel = sequelize.define(
    "regions",
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
        name: {
            type: DataTypes.STRING,
            allowNull: false
        }, 
        code: {
            type: DataTypes.STRING,
            allowNull: true
        }
    },{
        freezeTableName:true, tableName: "regions", timestamps: true
    }
    );
    return{
        RegionsModel
    }
}


