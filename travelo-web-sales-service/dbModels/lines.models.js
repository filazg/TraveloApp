const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const LinesModel = sequelize.define(
    "lines",
    {
        id:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uuid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        code: {
            type: DataTypes.STRING,
            allowNull: false
        },
        first_harbor_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        first_harbor_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        last_harbor_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        last_harbor_name: {
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
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        subsidised_line: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },  
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    },{
        freezeTableName:true, tableName: "lines", timestamps: true
    }
    );
    return{
        LinesModel
    }
}


