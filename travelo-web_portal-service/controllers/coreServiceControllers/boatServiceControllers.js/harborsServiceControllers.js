const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getHarborsController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.boat.url + '/harbors')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addHarborsController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        console.log(data)
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.boat.url + '/harbors', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateHarborsController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.boat.url + '/harbors', data)
        return (response.data)  
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getHarborsController,
    addHarborsController,
    updateHarborsController
}

