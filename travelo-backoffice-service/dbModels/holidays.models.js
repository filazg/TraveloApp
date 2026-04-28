const { DataTypes } = require("sequelize");

module.exports = (sequelize)=>{
    const HolidaysModel = sequelize.define(
        "holidays",
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
            date_from:{
                type:DataTypes.STRING,
                allowNull:false
            },
            date_to:{
                type:DataTypes.STRING,
                allowNull:false
            },
            is_active:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            },
        },
        { freezeTableName:true, tableName: "holidays", timestamps: true }
    )
    return{
        HolidaysModel
    }
}