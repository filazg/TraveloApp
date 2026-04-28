const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const ticketsModel = sequelize.define('tickets', {
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_group_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_type_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_type_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_single_price:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    ticket_is_active:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    ticket_is_canceled:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    sales_route_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_departure_planed:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_departure:{
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
    ticket_departure_harbor_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_departure_harbor_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_arrival_planed:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_arrival:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_arrival_harbor_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_arrival_harbor_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_deactivate_order_no:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_deactivate:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    ticket_validate_data:{
        type: Sequelize.DATE,
        allowNull: true
    },
    ticket_deactivate_data:{
        type: Sequelize.DATE,
        allowNull: true
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    order_number:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_status:{
        type: Sequelize.STRING,
        allowNull: true
    },
    order_item_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_send:{
        type: Sequelize.DATE,
        allowNull: true
    },
    card_data:{
        type:Sequelize.JSON,
        allowNull: true
    }
},{
    freezeTableName: true
})

const ticketsGroupsModel = sequelize.define('tickets_group', {
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_group_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_type_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    ticket_type_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    ticket_type_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    sales_route_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    single_price:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    total_price:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    total_vat_base:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    total_vat:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    total_harbor_tax:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    quantity:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    order_number:{
        type: Sequelize.STRING,
        allowNull: true
    },
    item_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
},{
    freezeTableName:true
})

module.exports={
    ticketsModel,
    ticketsGroupsModel
}