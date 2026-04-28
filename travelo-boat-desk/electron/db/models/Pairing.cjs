const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const pairingDataModel = sequelize.define('pairing_data',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    isPaired:{
        type: Sequelize.BOOLEAN,
        allowNull:false
    },
    tid:{
        type: Sequelize.STRING,
        allowNull:true
    },
    otp:{
        type: Sequelize.STRING,
        allowNull:true
    },
    token:{
        type: Sequelize.STRING,
        allowNull:true
    },
},{
    freezeTableName:true
})

module.exports={
    pairingDataModel
}