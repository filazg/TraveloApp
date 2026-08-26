const axios = require('axios')
const { controlServiceURL } = require('../config/config')

let coreConfigData = {}
let channelConfigData = {}
let databaseConfigData = {}
let integrationsConfigData = {}

// Kanali (portal, terminali, web prodaja) drze se u zasebnom configu, a
// dispatcher mora doci i do web prodaje kad se otkazuje polazak.
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
    getChannelServiceConfigData,
    syncChannelServiceConfigData,
    syncCoreServiceConfigData,
    getDatabaseConfigData,
    syncDatabaseConfigData,
    getIntegrationsConfigData,
    syncIntegrationsConfigData
}