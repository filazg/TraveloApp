const axios = require('axios')
const { controlServiceURL } = require('../../config/config')

let channelConfigData = {}
let coreConfigData = {}
let mainConfigData = {}

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

module.exports = {
    getChannelServiceConfigData,
    syncChannelServiceConfigData,
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getMainServiceConfigData,
    syncMainServiceConfigData
}