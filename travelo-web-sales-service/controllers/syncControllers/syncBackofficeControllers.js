const axios = require('axios')
const { getSequelize } = require("../../config/database");
const { getCoreServiceConfigData } = require("../configSyncController");
const { getModels } = require('../../dbModels');

const syncBusinessPremisesController = async()=>{
    const {BusinessPremisesModel} = getModels();
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/business_premises')
        await BusinessPremisesModel.truncate()
        await BusinessPremisesModel.bulkCreate(response.data.data.business_premises)
        return 
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    syncBusinessPremisesController
}