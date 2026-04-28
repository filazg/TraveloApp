const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getHolidaysController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.backoffice.url + '/holidays')
            return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addHolidayController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.post(coreConfigData.services.backoffice.url + '/holidays', data)
                return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateHolidayController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/holidays', data)
                return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getHolidaysController,
    addHolidayController,
    updateHolidayController
}