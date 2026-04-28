const axios = require('axios')
const { controlServiceURL } = require('../config/config')

let coreConfigData = {}
let databaseConfigData = {}


const getChannelServiceConfigData = ()=>{
    return channelConfigData
}

const syncChannelServiceConfigData = async ()=>{
    try {
        const configData = await axios.get(controlServiceURL + '/channel_services_config')
        channelConfigData = await configData.data.data
    } catch (error) {
        console.log(error)
    }
}

const getCoreServiceConfigData = ()=>{
    return coreConfigData
}

const syncCoreServiceConfigData = async ()=>{
    try {
        const configData = await axios.get(controlServiceURL + '/core_services_config')
        coreConfigData = await configData.data.data
    } catch (error) {
        console.log(error)
    }
}

const getDatabaseConfigData = ()=>{
    return databaseConfigData
}

const syncDatabaseConfigData = async() =>{
    try {
        const configData = await axios.post(controlServiceURL + '/database_services_config', {service:'web_sales_service'})
        databaseConfigData = await configData.data
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getChannelServiceConfigData,
    syncChannelServiceConfigData,
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getDatabaseConfigData,
    syncDatabaseConfigData
}