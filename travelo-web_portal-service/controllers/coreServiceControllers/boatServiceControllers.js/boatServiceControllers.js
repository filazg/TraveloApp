const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getBoatsController = async () => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.boat.url + '/boats')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addBoatsController = async (data) => {
    try {
       const coreConfigData = await getCoreServiceConfigData()
       const response = await axios.post(coreConfigData.services.boat.url + '/boats', data) 
       return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateBoatsController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.boat.url + '/boats', data) 
        return (response.data) 
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getBoatsController,
    addBoatsController,
    updateBoatsController
}