const axios = require('axios')
const { controlServiceURL } = require('../config/config')

let mainConfigData = {}
let channalConfigData = {}
let coreConfigData = {}

const getMainServiceConfigData = ()=>{
    return mainConfigData
}

const syncMainServiceConfigData = async ()=>{
    try {
        const configData = await axios.get(controlServiceURL + '/main_services_config')
        mainConfigData = await configData.data.data
    } catch (error) {

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

    }
}

module.exports = {
    getMainServiceConfigData,
    syncMainServiceConfigData,
    getChannalServiceConfigData,
    syncChannalServiceConfigData,
    getCoreServiceConfigData,
    syncCoreServiceConfigData
}