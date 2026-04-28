const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')
const { travelo_publisher } = require('../../publisherController')

const getAddressbookController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/addressbook')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}
const addAddressbookController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.backoffice.url + '/addressbook', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateAddressbookController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/addressbook', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getAddressbookController,
    addAddressbookController,
    updateAddressbookController
}