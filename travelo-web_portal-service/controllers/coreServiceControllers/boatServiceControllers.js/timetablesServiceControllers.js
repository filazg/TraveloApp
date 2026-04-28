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
    }
}

module.exports = {
    getTimetablesController,
    getTimetablesDetailsController,
    addTimetableController
}