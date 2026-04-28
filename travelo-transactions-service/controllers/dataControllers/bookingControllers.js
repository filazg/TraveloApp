const axios = require('axios')
const { createBookingHelper } = require("../../helpers/createBookingHalpers")
const { getCoreServiceConfigData } = require("../configSyncController")


const addBookingController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.post(coreConfigData.services.boat.url + '/sales_routes', data={data:data})
        await createBookingHelper(response.data.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    addBookingController
}