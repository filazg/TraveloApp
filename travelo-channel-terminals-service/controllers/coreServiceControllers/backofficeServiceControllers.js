const axios = require('axios')
const { getCoreServiceConfigData } = require('../configServices/configSyncController')

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

const getBusinessPremisesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/business_premises')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const getBillingDevicesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/billing_devices')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const getUsersController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/users')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const getPaymentMethodsController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/payment_methods')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

// Postotci storniranja — terminal ih nudi blagajniku kao izbor pri povratu.
// Bez `all=1` vraćaju se samo aktivni; deaktivirane ne treba nuditi.
const getStornoPercentagesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.backoffice.url + '/storno_percentages')
        return (response.data)
    } catch (error) {
        console.log('getStornoPercentagesController error:', error?.message || error)
    }
}

// Provjera OIB-a u Sudskom registru — proxy prema backoffice servisu.
// Vraća cijeli odgovor ({ status, data: { result: {...} } }); raspakiravanje
// radi handler.
const getSudregLookupController = async (oib) => {
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.get(coreConfigData.services.backoffice.url + '/sudreg', { params: { oib } })
    return (response.data)
}

// Centralni adresar — proxy prema backoffice GET /addressbook.
// Vraća cijeli odgovor ({ status, data: { addressbook: [...] } }); raspakiravanje
// radi handler.
const getAddressbookController = async () => {
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.get(coreConfigData.services.backoffice.url + '/addressbook')
    return (response.data)
}

// Upis/ažuriranje kupca u centralnom adresaru — proxy prema backoffice
// POST /addressbook/upsert. `body` je cijeli objekt oblika { body: {...} } koji
// se prosljeđuje kakav jest (idempotentno po OIB-u).
const upsertAddressbookController = async (body) => {
    const coreConfigData = await getCoreServiceConfigData()
    const response = await axios.post(coreConfigData.services.backoffice.url + '/addressbook/upsert', body)
    return (response.data)
}

module.exports = {
    getCompanyController,
    getBusinessPremisesController,
    getBillingDevicesController,
    getUsersController,
    getPaymentMethodsController,
    getStornoPercentagesController,
    getSudregLookupController,
    getAddressbookController,
    upsertAddressbookController
}