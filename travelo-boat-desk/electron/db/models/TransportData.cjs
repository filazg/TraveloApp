const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const salesRoutesDataModel = sequelize.define('sales_routes', {
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    uuid: {
        type: Sequelize.STRING,
        allowNull: false
    },
    code: {
        type: Sequelize.STRING,
        allowNull: false
    },
    timetable_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    sequence: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    departure: {
        type: Sequelize.STRING,
        allowNull: true
    },
    departure_date: {
        type: Sequelize.STRING,
        allowNull: true
    },
    departure_time: {
        type: Sequelize.STRING,
        allowNull: true
    },
    actual_departure: {
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
    departure_harbor_order:{
        type: Sequelize.STRING,
        allowNull: false
    },
    departure_harbor_id:{
        type: Sequelize.STRING,
        allowNull: false
    },
    departure_harbor_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    arrival_harbor_order:{
        type: Sequelize.STRING,
        allowNull: false
    },
    arrival_harbor_id:{
        type: Sequelize.STRING,
        allowNull: false
    },
    arrival_harbor_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    timetable_code:{
        type: Sequelize.STRING,
        allowNull: false
    },
    timetable_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    line_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    line_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    line_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    subsidised_tickets: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    direction:{
        type: Sequelize.STRING,
        allowNull: true
    },
},{
    freezeTableName:true
});

const salesRoutePricesDataModel = sequelize.define('sales_routes_price',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    timetable_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    harbor_from:{
        type: Sequelize.STRING,
        allowNull: false
    },
    harbor_from_code:{
        type: Sequelize.STRING,
        allowNull: false
    },
    harbor_from_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    harbor_to:{
        type: Sequelize.STRING,
        allowNull: false
    },
    harbor_to_code:{
        type: Sequelize.STRING,
        allowNull: false
    },
    harbor_to_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    vat_rate:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    vat_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_type_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    ticket_type_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    ticket_type_description:{
        type: Sequelize.STRING,
        allowNull: true
    },
    price:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    vat_base:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    vat_amount:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    port_tax:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    seop_type:{
        type: Sequelize.STRING,
        allowNull: true
    },
    // Otočna karta — propagirano iz backend tickets_types.is_island. Boolean
    // marker za "kartu sa popustom za otočne korisnike", ne pojavljuje se u
    // redovnoj listi cijena nego se prodaje kroz POVLAŠTENE KARTICE modal.
    is_island:{
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
},{
    freezeTableName:true
})

const linesDataModel = sequelize.define('lines',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    code:{
        type: Sequelize.STRING,
        allowNull: false
    },
    name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    label:{
        type: Sequelize.STRING,
        allowNull: true
    },
    first_harbor_id: {
        type: Sequelize.STRING,
        allowNull: true
    },
    first_harbor_name: {
        type: Sequelize.STRING,
        allowNull: true
    },
    last_harbor_id: {
        type: Sequelize.STRING,
        allowNull: true
    },
    last_harbor_name: {
        type: Sequelize.STRING,
        allowNull: true
    },
    subsidised_line: {
        type: Sequelize.BOOLEAN,
        allowNull: true
    },  
},{
    freezeTableName:true
})

const harborsDataModel = sequelize.define('harbors', {
    id:{
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    uuid:{
        type:Sequelize.STRING,
        allowNull: true
    },
    name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    seop_island: {
        type: Sequelize.STRING,
        allowNull: true
    }
},{
    freezeTableName: true
});


module.exports = {
    salesRoutesDataModel,
    salesRoutePricesDataModel,
    linesDataModel,
    harborsDataModel
}