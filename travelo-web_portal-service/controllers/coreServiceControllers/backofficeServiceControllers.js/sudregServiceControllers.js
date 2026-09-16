const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')
const { travelo_publisher } = require('../../publisherController')

const getSudregLookupController = async(oib)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/sudreg', { params: { oib } })
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getSudregLookupController
}
