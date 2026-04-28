const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const TimetablePricesModel = sequelize.define(
    "timetable_prices",
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
        timetable_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        harbor_from:{
            type: DataTypes.STRING,
            allowNull: false
        },
        harbor_from_code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        harbor_from_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        harbor_to:{
            type: DataTypes.STRING,
            allowNull: false
        },
        harbor_to_code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        harbor_to_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        vat_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        vat_rate:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        vat_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        ticket_type_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        ticket_type_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        ticket_type_name_eng:{
            type: DataTypes.STRING,
            allowNull: true
        },
        ticket_type_description:{
            type: DataTypes.STRING,
            allowNull: true
        },
        price:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        // Snapshot iz tickets_types.is_island u trenutku spremanja cjenika.
        is_island:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        vat_base:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        vat_amount:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        port_tax:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        seop_type:{
            type: DataTypes.STRING,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    },{
        freezeTableName:true, tableName: "timetable_prices", timestamps: true
    }
    );
    return{
        TimetablePricesModel
    }
}


