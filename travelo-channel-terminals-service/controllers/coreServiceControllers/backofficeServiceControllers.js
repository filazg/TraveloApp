const axios = require('axios')
const { getCoreServiceConfigData } = require('../configServices/configSyncController')

const getCompanyController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/company')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

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

const getUsersController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/users')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

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

module.exports = {
    getCompanyController,
    getBusinessPremisesController,
    getBillingDevicesController,
    getUsersController,
    getPaymentMethodsController
}