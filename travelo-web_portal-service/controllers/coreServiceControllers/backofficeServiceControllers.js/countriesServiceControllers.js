const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const getCountriesController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.backoffice.url + '/countries', { params })
        return response.data
    } catch (error) {
        console.log('getCountriesController error:', error?.message || error)
        return { status: 500, data: { countries: [] } }
    }
}

const addCountryController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.post(coreConfigData.services.backoffice.url + '/countries', data)
        return response.data
    } catch (error) {
        console.log('addCountryController error:', error?.message || error)
        return { status: 500 }
    }
}

const updateCountryController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/countries', data)
        return response.data
    } catch (error) {
        console.log('updateCountryController error:', error?.message || error)
        return { status: 500 }
    }
}

module.exports = {
    getCountriesController,
    addCountryController,
    updateCountryController,
}
