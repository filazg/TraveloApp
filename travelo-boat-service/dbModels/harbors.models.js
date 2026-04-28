const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const HarborsModel = sequelize.define(
    "harbors",
    {
        id:{
            type:DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uuid:{
            type:DataTypes.STRING,
            allowNull: false
        },
        name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        longitude: {
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        latitude: {
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true
        },
        region: {
            type: DataTypes.STRING,
            allowNull: true
        },
        region_uuid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        country: {
            type: DataTypes.STRING,
            allowNull: true
        },
        seop_island: {
            type: DataTypes.STRING,
            allowNull: true
        },
        updated_by_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        updated_by_username:{
            type: DataTypes.STRING,
            allowNull: true
        },
    },{
        freezeTableName:true, tableName: "harbors", timestamps: true
    }
    );
    return{
        HarborsModel
    }
}


