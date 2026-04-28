const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const BookingModel = sequelize.define(
    "booking",
    {
        id:{
            type: DataTypes.INTEGER,
            primaryKey:true,
            autoIncrement:true
        },
        uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        timetable_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        routes_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        routes_code:{
            type: DataTypes.STRING,
            allowNull: true
        },
        voyage_id:{
            type: DataTypes.STRING,
            allowNull: true
        },
        sequence:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        departure: {
            type: DataTypes.STRING,
            allowNull: true
        },
        actual_departure: {
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_harbor_order:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        departure_harbor_id:{
            type: DataTypes.STRING,
            allowNull: true
        },
        departure_harbor_name:{
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
        arrival_harbor_order:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        arrival_harbor_id:{
            type: DataTypes.STRING,
            allowNull: true
        },
        arrival_harbor_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        timetable_code:{
            type: DataTypes.STRING,
            allowNull: true
        },
        timetable_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        line_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        line_code:{
            type: DataTypes.STRING,
            allowNull: true
        },
        line_name:{
            type: DataTypes.STRING,
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
        passanger_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_vip_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        pets_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bicycle_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        additional_passanger_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        additional_passanger_vip_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        additional_pets_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        additional_bicycle_capacity:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_in:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_vip_in:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        pets_in:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bicycle_in:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_out:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_vip_out:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        pets_out:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bicycle_out:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_occupied:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_vip_occupied:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        pets_occupied:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bicycle_occupied:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_validate:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passanger_vip_validate:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        pets_validate:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bicycle_validate:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        booking_is_active:{
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
    },{
        freezeTableName:true, tableName: "booking", timestamps: true
    },
    );
    const BookingTicketTypesModel = sequelize.define(
        "booking_ticket_types",{
            id:{
                type: DataTypes.INTEGER,
                primaryKey:true,
                autoIncrement:true
            },
            uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            booking_type_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            booking_type_name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            ticket_type_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            ticket_type_name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            is_active:{
                type: DataTypes.BOOLEAN,
                allowNull: true
            },
        },{
        freezeTableName:true, tableName: "booking_ticket_types", timestamps: true
    },
    );
    const BookingTypesModel = sequelize.define(
        "booking_types",{
            id:{
                type: DataTypes.INTEGER,
                primaryKey:true,
                autoIncrement:true
            },
            uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            acr:{
                type: DataTypes.STRING,
                allowNull: true
            },
            name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            is_active:{
                type: DataTypes.BOOLEAN,
                allowNull: true
            },
        },{
        freezeTableName:true, tableName: "booking_types", timestamps: true
    },
    )
    return{
        BookingModel,
        BookingTicketTypesModel,
        BookingTypesModel
    }
}