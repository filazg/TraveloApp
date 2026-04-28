const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const systemSettingsDataModel = sequelize.define('system_settings',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    backend_url:{
        type: Sequelize.STRING,
        allowNull:true
    },
    printer_location:{
        type: Sequelize.STRING,
        allowNull:true
    },
    printer_width:{
        type: Sequelize.STRING,
        allowNull:true
    },
    printer_ticket_location:{
        type: Sequelize.STRING,
        allowNull:true
    },
    card_reader:{
        type: Sequelize.STRING,
        allowNull:true
    },
    pos_port:{
        type: Sequelize.STRING,
        allowNull:true
    },
    auto_validate:{
        type: Sequelize.BOOLEAN,
        allowNull:true
    },
    pos_print_on_app:{
        type: Sequelize.BOOLEAN,
        allowNull:true
    },
    pos_print_additional_slip:{
        type: Sequelize.BOOLEAN,
        allowNull:true
    },
},{
    freezeTableName:true
})

module.exports={
    systemSettingsDataModel
}