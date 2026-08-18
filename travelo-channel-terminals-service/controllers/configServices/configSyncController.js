const axios = require('axios')
const { controlServiceURL } = require('../../config/config')

let channelConfigData = {}
let coreConfigData = {}
let integrationsConfigData = {}

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

// 7pay kredencijali za mobilne terminale stizu iz control-servisa, da ne stoje
// u kodu ni u bazi terminala.
const getIntegrationsConfigData = ()=>{
    return integrationsConfigData
}

const syncIntegrationsConfigData = async ()=>{
    try {
        const configData = await axios.get(controlServiceURL + '/integrations_config')
        integrationsConfigData = await configData.data.data
    } catch (error) {
        console.log('syncIntegrationsConfigData error:', error?.message || error)
    }
}

module.exports = {
    getIntegrationsConfigData,
    syncIntegrationsConfigData,
    getChannelServiceConfigData,
    syncChannelServiceConfigData,
    getCoreServiceConfigData,
    syncCoreServiceConfigData
}