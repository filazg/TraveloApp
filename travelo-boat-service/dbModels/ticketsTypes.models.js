const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const TicketsTypesModel = sequelize.define(
    "tickets_types",
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
        name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        name_eng:{
            type: DataTypes.STRING,
            allowNull: true
        },
        booking_type_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        booking_type_acr:{
            type: DataTypes.STRING,
            allowNull: true
        },
        booking_type_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        seop_type:{
            type: DataTypes.STRING,
            allowNull: true
        },
        // Otočna karta — ako je true, prilikom prodaje se traži otočna iskaznica
        // i SEOP popust se primjenjuje na cijenu iz cjenika.
        is_island:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        is_active:{
            type: DataTypes.BOOLEAN,
            allowNull: false
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
        freezeTableName:true, tableName: "tickets_types", timestamps: true
    }
    );
    return{
        TicketsTypesModel
    }
}


