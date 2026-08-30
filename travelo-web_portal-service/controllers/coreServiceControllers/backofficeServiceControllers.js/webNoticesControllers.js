const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

// Obavijesti za web stranicu — cuvaju se u backofficeu, uz ostale podatke koje
// odrzava administrator.
const getWebNoticesController = async () => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.backoffice.url + '/web_notices')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addWebNoticeController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.post(coreConfigData.services.backoffice.url + '/web_notices', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateWebNoticeController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/web_notices', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getWebNoticesController,
    addWebNoticeController,
    updateWebNoticeController
}
