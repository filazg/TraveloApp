const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getLinesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.boat.url + '/lines')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addLinesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.post(coreConfigData.services.boat.url + '/lines', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateLinesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.boat.url + '/lines', data)
        return (response.data)  
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getLinesController,
    addLinesController,
    updateLinesController
}