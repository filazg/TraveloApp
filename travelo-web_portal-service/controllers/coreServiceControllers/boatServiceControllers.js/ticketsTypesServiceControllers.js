const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getTicketTypesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.boat.url + '/tickets_types')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addTicketTypesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.post(coreConfigData.services.boat.url + '/tickets_types', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateTicketTypesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.boat.url + '/tickets_types', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getTicketTypesController,
    addTicketTypesController,
    updateTicketTypesController
}