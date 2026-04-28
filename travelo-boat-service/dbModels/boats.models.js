const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const BoatsModel = sequelize.define(
    "boats",
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
        nib: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        imo: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        capacity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        vip_capacity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        pets_capacity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bicycle_capacity: {
            type: DataTypes.INTEGER,
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
        freezeTableName:true, tableName: "boats", timestamps: true
    }
    );
    return{
        BoatsModel
    }
}


