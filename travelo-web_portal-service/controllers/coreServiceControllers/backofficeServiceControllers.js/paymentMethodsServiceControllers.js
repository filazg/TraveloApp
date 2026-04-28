const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getPaymentMethodsController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/payment_methods')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}
const addPaymentMethodsController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.backoffice.url + '/payment_methods', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updatePaymentMethodsController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/payment_methods', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getPaymentMethodsController,
    addPaymentMethodsController,
    updatePaymentMethodsController
}