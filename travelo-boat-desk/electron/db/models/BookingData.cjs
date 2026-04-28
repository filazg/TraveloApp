const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const bookingModel = sequelize.define('booking',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey:true,
        autoIncrement:true
    },
    booking_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    timetable_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    departure_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    routes_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    voyage_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    sequence:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    departure: {
        type: Sequelize.STRING,
        allowNull: true
    },
    actual_departure: {
        type: Sequelize.STRING,
        allowNull: true
    },
    departure_harbor_order:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    departure_harbor_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    departure_harbor_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    arrival: {
        type: Sequelize.STRING,
        allowNull: true
    },
    actual_arrival: {
        type: Sequelize.STRING,
        allowNull: true
    },
    arrival_harbor_order:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    arrival_harbor_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    arrival_harbor_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    timetable_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    timetable_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    line_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    line_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    line_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    label:{
        type: Sequelize.STRING,
        allowNull: true
    },
    direction:{
        type: Sequelize.STRING,
        allowNull: true
    },
    passanger_capacity:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    passanger_vip_capacity:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    pets_capacity:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    bicycle_capacity:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    passanger_in:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    passanger_vip_in:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    pets_in:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    bicycle_in:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    passanger_out:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    passanger_vip_out:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    pets_out:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    bicycle_out:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    passanger_occupied:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    passanger_vip_occupied:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    pets_occupied:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    bicycle_occupied:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    booking_is_active:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
},{
    freezeTableName:true
})

module.exports = {
    bookingModel,
}