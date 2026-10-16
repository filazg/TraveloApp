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

// Uvoz adresara iz SAOP-a. Za razliku od ostalih, greska se ne guta — portal
// mora javiti da uvoz nije uspio.
const syncAddressbookFromSaopController = async()=>{
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.post(coreConfigData.services.backoffice.url + '/addressbook/saop_sync', {}, { timeout: 300000 })
    if (response.data?.status !== 200) throw new Error(response.data?.data?.error || 'Uvoz iz SAOP-a nije uspio')
    return response.data.data
}

module.exports = {
    syncAddressbookFromSaopController,
    getAddressbookController,
    addAddressbookController,
    updateAddressbookController
}