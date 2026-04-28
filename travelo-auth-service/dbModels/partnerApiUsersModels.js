const Sequelize = require('sequelize');
const { db } = require('../config/database');

const partnerApiUsersModels = db.define('partner_api_users',{
    id:{
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    uuid:{
        type:Sequelize.STRING,
        allowNull:false
    },
    partner_uuid:{
        type:Sequelize.STRING,
        allowNull:false
    },
    partner_name:{
        type:Sequelize.STRING,
        allowNull:false
    },
    tid:{
        type:Sequelize.STRING,
        allowNull:false
    },
    otp:{
        type:Sequelize.STRING,
        allowNull:false
    },
    key:{
        type:Sequelize.STRING,
        allowNull:false
    },
    refreshToken:{
        type:Sequelize.STRING,
        allowNull:true
    },
    is_active:{
        type:Sequelize.BOOLEAN,
        allowNull:false
    },
},{
    freezeTableName: true
})

module.exports = {
    partnerApiUsersModels
}