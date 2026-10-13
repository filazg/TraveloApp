const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')


const getTimetablesController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.boat.url + '/timetables')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const getTimetablesDetailsController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        console.log('tusmo ', data)
        const response = await axios.post(coreConfigData.services.boat.url + '/timetable_details', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const addTimetableController = async(data)=>{
    try {
        console.log(data)
        const coreConfigData = await getCoreServiceConfigData()
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.boat.url + '/timetables', data)
        return (response.data)
    } catch (error) {
        console.log(error)
        // Greska ide dalje: dosad se gutala, pa je portal dobio "uspjeh" i
        // pokrenula se sinkronizacija prodaje iako boat nista nije spremio.
        throw new Error(error?.response?.data?.msg || error?.message || 'Spremanje plovidbenog reda nije uspjelo')
    }
}

module.exports = {
    getTimetablesController,
    getTimetablesDetailsController,
    addTimetableController
}