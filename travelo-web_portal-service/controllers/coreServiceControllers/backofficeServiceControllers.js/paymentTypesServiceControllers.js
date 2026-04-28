const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getPaymentTypesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/payment_types')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getPaymentTypesController
}