const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const TimetablesModel = sequelize.define(
    "timetables",
    {
        id:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_code:{
            type: DataTypes.STRING,
            allowNull: true
        },
        line_name:{
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
        is_active:{
            type: DataTypes.BOOLEAN,
            allowNull:false
        }
    },{
        freezeTableName:true, tableName: "timetables", timestamps: true
    }
    );
    return{
        TimetablesModel
    }
}


