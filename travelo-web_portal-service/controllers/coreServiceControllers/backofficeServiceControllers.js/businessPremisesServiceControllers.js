const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getBusinessPremisesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/business_premises')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}
const addBusinessPremisesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.backoffice.url + '/business_premises', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateBusinessPremisesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/business_premises', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getBusinessPremisesController,
    addBusinessPremisesController,
    updateBusinessPremisesController
}