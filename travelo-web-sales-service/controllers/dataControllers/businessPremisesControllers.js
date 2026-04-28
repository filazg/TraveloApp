const { getSequelize } = require("../../config/database");

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

module.exports = {
    getBusinessPremisesController
}