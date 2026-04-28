const axios = require('axios')
const { getSequelize } = require("../../config/database");
const { getCoreServiceConfigData } = require("../configSyncController");
const { getModels } = require('../../dbModels');

const syncHarborsDataController = async()=>{
    try {
        const { HarborsModel } = getModels();
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.boat.url + '/harbors')
        await HarborsModel.truncate()
        await HarborsModel.bulkCreate(response.data.data.harbors)
        return         
    } catch (error) {
        console.log(error)
    }
}

const syncLinesDataController = async()=>{
    try {
        const { LinesModel } = getModels();
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.boat.url + '/lines')
        console.log('LINES DATA ', response.data.data)
        await LinesModel.truncate()
        await LinesModel.bulkCreate(response.data.data.lines)
        return         
    } catch (error) {
        console.log(error)
    }
}

const syncRoutesDataController = async(data)=>{
    try {
        console.log('ROutres DATA ', data)
        const { RoutesModel, TimetablePricesModel } = getModels();
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.post(coreConfigData.services.boat.url + '/sales_routes', data={data:data})
        await RoutesModel.destroy({
            where: {
                timetable_uuid: response.data.data.timetable_uuid
            }
        });
        await TimetablePricesModel.destroy({
            where: {
                timetable_uuid: response.data.data.timetable_uuid
            }
        });
        await RoutesModel.bulkCreate(response.data.data.routes)
        await TimetablePricesModel.bulkCreate(response.data.data.prices)
        return         
    } catch (error) {
        console.log(error)
    }
}

const syncAllRoutesDataController = async()=>{
    const { RoutesModel, TimetablePricesModel } = getModels();
    const coreConfigData = await getCoreServiceConfigData() 
    const response = await axios.get(coreConfigData.services.boat.url + '/sales_routes')
    await RoutesModel.truncate()
    await TimetablePricesModel.truncate()
    await RoutesModel.bulkCreate(response.data.data.routes)
    await TimetablePricesModel.bulkCreate(response.data.data.prices)
}

module.exports = {
    syncHarborsDataController,
    syncLinesDataController,
    syncRoutesDataController,
    syncAllRoutesDataController
}