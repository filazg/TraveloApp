const axios = require('axios')
const { controlServiceURL } = require('../config/config')

let mainConfigData = {}
let channalConfigData = {}
let coreConfigData = {}
let databaseConfigData = {}

const getMainServiceConfigData = ()=>{
    return mainConfigData
}

const syncMainServiceConfigData = async ()=>{
    try {
        const configData = await axios.get(controlServiceURL + '/main_services_config')
        mainConfigData = await configData.data.data
    } catch (error) {
        console.log(error)
    }
}

const getChannalServiceConfigData = ()=>{
    return channalConfigData
}

const syncChannalServiceConfigData = async ()=>{
    try {
        const configData = await axios.get(controlServiceURL + '/channel_services_config')
        channalConfigData = await configData.data.data
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
        const configData = await axios.post(controlServiceURL + '/database_services_config', {service:'auth_service', profile: process.env.TRAVELO_PROFILE})
        databaseConfigData = await configData.data
        console.log('gotovo')
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getMainServiceConfigData,
    syncMainServiceConfigData,
    getChannalServiceConfigData,
    syncChannalServiceConfigData,
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getDatabaseConfigData,
    syncDatabaseConfigData
}