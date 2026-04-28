const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')
const { travelo_publisher } = require('../../publisherController')

const getPartnersController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/partners')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}
const addPartnerController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.backoffice.url + '/partners', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updatePartnerController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/partners', data)
        await travelo_publisher('travelo_auth_service', {path:'update_partners'})
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getPartnersController,
    addPartnerController,
    updatePartnerController
}