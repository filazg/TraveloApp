const axios = require('axios')
const { controlServiceURL } = require('../config/config')

let coreConfigData = {}
let databaseConfigData = {}
let integrationsConfigData = {}

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
        const configData = await axios.post(controlServiceURL + '/database_services_config', {service:'transactions_service', profile: process.env.TRAVELO_PROFILE})
        databaseConfigData = await configData.data
        console.log('gotovo')
    } catch (error) {
        console.log(error)
    }
}

const getIntegrationsConfigData = () => integrationsConfigData

const syncIntegrationsConfigData = async () => {
    try {
        const resp = await axios.get(controlServiceURL + '/integrations_config')
        integrationsConfigData = resp.data?.data || {}
    } catch (error) {
        console.log('syncIntegrationsConfigData error:', error?.message || error)
    }
}

module.exports = {
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getDatabaseConfigData,
    syncDatabaseConfigData,
    getIntegrationsConfigData,
    syncIntegrationsConfigData
}