const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getRegionsController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.boat.url + '/regions')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addRegionsController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.post(coreConfigData.services.boat.url + '/regions', data)
        return (response.data)
    } catch (error) {
        console.log(error) 
    }
}

const updateRegionsController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.boat.url + '/regions', data)
        return (response.data)  
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getRegionsController,
    addRegionsController,
    updateRegionsController
}