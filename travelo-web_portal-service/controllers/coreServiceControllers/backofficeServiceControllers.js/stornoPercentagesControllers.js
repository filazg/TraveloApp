const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

// Administracija mora vidjeti i deaktivirane postotke da ih može vratiti u
// upotrebu, pa se ovdje traži `all=1`. Terminali isti endpoint zovu bez toga i
// dobiju samo aktivne.
const getStornoPercentagesController = async () => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.backoffice.url + '/storno_percentages', { params: { all: 1 } })
        return (response.data)
    } catch (error) {
        console.log('getStornoPercentagesController error:', error?.message || error)
    }
}

const addStornoPercentageController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.post(coreConfigData.services.backoffice.url + '/storno_percentages', data)
        return (response.data)
    } catch (error) {
        console.log('addStornoPercentageController error:', error?.message || error)
    }
}

const updateStornoPercentageController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/storno_percentages', data)
        return (response.data)
    } catch (error) {
        console.log('updateStornoPercentageController error:', error?.message || error)
    }
}

module.exports = {
    getStornoPercentagesController,
    addStornoPercentageController,
    updateStornoPercentageController
}
