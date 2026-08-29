const axios = require('axios')
const { getCoreServiceConfigData } = require("../configServices/configSyncController")

const getHarborsController = async()=>{
    try {
        console.log('HArbors DATA START')
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.sales.url + '/harbors')
        console.log('HArbors DATA ', response.data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const getLinesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.sales.url + '/lines')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const getRoutesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.sales.url + '/routes')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const getPricesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        // API partner prodaje u svoje ime, pa mu se komunicira nasa cijena prema
        // njemu: bez PDV-a, s luckom pristojbom u sebi. Koliko ce naplatiti
        // putniku njegova je stvar i mi to ne znamo.
        const response = await axios.get(coreConfigData.services.sales.url + '/prices', {
            params: { channel: 'partner_web' },
        })
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getHarborsController,
    getLinesController,
    getRoutesController,
    getPricesController
}