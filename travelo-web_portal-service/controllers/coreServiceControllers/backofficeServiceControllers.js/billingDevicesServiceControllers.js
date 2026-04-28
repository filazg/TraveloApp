const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getBillingDevicesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/billing_devices')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}
const addBillingDevicesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.backoffice.url + '/billing_devices', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateBillingDevicesController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/billing_devices', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getBillingDevicesController,
    addBillingDevicesController,
    updateBillingDevicesController
}