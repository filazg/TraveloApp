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

// Generiranje TID-a (acr + oznaka tipa + redni broj) radi backoffice servis,
// da se redni broj računa nad stvarnim stanjem u bazi, a ne u pregledniku.
const getNextTidController = async(type)=>{
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.get(
        coreConfigData.services.backoffice.url + '/billing_devices/next_tid',
        { params: { type } }
    )
    return (response.data)
}

const getNextOtpController = async()=>{
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.get(coreConfigData.services.backoffice.url + '/billing_devices/next_otp')
    return (response.data)
}

const getDeviceModelsController = async()=>{
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.get(coreConfigData.services.backoffice.url + '/device_models')
    return (response.data)
}

const getDeviceSerialNumbersController = async(params)=>{
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.get(
        coreConfigData.services.backoffice.url + '/device_serial_numbers',
        { params }
    )
    return (response.data)
}

module.exports = {
    getBillingDevicesController,
    addBillingDevicesController,
    updateBillingDevicesController,
    getNextTidController,
    getNextOtpController,
    getDeviceModelsController,
    getDeviceSerialNumbersController
}