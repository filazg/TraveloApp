const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const RoutesModel = sequelize.define(
    "routes",
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
        code: {
            type: DataTypes.STRING,
            allowNull: false
        },
        timetable_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        voyage_id:{
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_uuid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        sequence: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        departure: {
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_date: {
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_time: {
            type: DataTypes.STRING,
            allowNull: true
        },
        actual_departure: {
            type: DataTypes.STRING,
            allowNull: true
        },
        arrival: {
            type: DataTypes.STRING,
            allowNull: true
        },
        actual_arrival: {
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_harbor_order:{
            type: DataTypes.STRING,
            allowNull: false
        },
        departure_harbor_id:{
            type: DataTypes.STRING,
            allowNull: false
        },
        departure_harbor_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival_harbor_order:{
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival_harbor_id:{
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival_harbor_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        timetable_code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        timetable_name:{
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
        subsidised_tickets: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        label:{
            type: DataTypes.STRING,
            allowNull: true
        },
        direction:{
            type: DataTypes.STRING,
            allowNull: true
        },
        sale_status:{
            type: DataTypes.STRING,
            allowNull: true
        },
        status:{
            type: DataTypes.STRING,
            allowNull: true
        },
        arrival_canceled:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        arrival_delay_minutes:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        arrival_note:{
            type: DataTypes.TEXT,
            allowNull: true
        },
        departure_delay_minutes:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        departure_note:{
            type: DataTypes.TEXT,
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
        freezeTableName:true, tableName: "routes", timestamps: true
    }
    );
    return{
        RoutesModel
    }
}


