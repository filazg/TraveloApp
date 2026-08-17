const axios = require('axios')
const { controlServiceURL } = require('../config/config')

let coreConfigData = {}
let databaseConfigData = {}

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
        const configData = await axios.post(controlServiceURL + '/database_services_config', {service:'sales_service', profile: process.env.TRAVELO_PROFILE})
        databaseConfigData = await configData.data
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getDatabaseConfigData,
    syncDatabaseConfigData
}