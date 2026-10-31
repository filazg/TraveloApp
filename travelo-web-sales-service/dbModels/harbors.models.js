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
        // Napomene uz luku za web prodaju (npr. Pomena: „U slučaju nepovoljnih
        // vremenskih uvjeta, moguć je polazak iz luke Sobra.") — posebno kad je
        // luka polazište i kad je odredište, HR i EN.
        departure_note: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        departure_note_eng: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        arrival_note: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        arrival_note_eng: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: true
        }
    },{
        freezeTableName:true, tableName: "harbors", timestamps: true
    }
    );
    return{
        HarborsModel
    }
}


