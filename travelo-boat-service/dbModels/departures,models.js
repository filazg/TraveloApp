const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const DeparturesModel = sequelize.define(
    "departures",
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
        timetable_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        sequence: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        voyage_id:{
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_harbor_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        departure_harbor_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival_harbor_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival_harbor_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        departure_planed: {
            type: DataTypes.STRING,
            allowNull: true
        },
        departure: {
            type: DataTypes.STRING,
            allowNull: true
        },
        arrival_planed: {
            type: DataTypes.STRING,
            allowNull: true
        },
        arrival: {
            type: DataTypes.STRING,
            allowNull: true
        },
        harbor_order: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        direction: {
            type: DataTypes.STRING,
            allowNull: false
        },
        boat_uuid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        base_capacity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        base_vip_capacity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        base_pets_capacity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        base_bicycle_capacity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        ret_koef: {
            type: DataTypes.DECIMAL,
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
        },
        is_actual:{
            type: DataTypes.BOOLEAN,
            allowNull:true
        }
    },{
        freezeTableName:true, tableName: "departures", timestamps: true
    }
    );
    return{
        DeparturesModel
    }
}


