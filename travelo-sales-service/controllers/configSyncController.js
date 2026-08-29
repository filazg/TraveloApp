const axios = require('axios')
const { controlServiceURL } = require('../config/config')

let coreConfigData = {}
// Glavni servisi (auth, gateway) stoje odvojeno od jezgre; treba nam adresa
// auth-servisa da se provjeri partnerska prijava.
let mainConfigData = {}
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

const getMainServiceConfigData = ()=>{
    return mainConfigData
}

const syncMainServiceConfigData = async ()=>{
    try {
        const configData = await axios.get(controlServiceURL + '/main_services_config')
        mainConfigData = await configData.data.data
    } catch (error) {
        console.log('syncMainServiceConfigData error:', error?.message || error)
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
    getMainServiceConfigData,
    syncMainServiceConfigData,
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getDatabaseConfigData,
    syncDatabaseConfigData
}