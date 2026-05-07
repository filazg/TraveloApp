const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

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

const updateCompanyController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/company', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getCompanyController,
    updateCompanyController,
}
