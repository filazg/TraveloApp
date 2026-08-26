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
        // Brisanje i punjenje moraju biti jedan zahvat. Bez transakcije je
        // vozni red tog reda prazan sve dok punjenje traje, pa blagajna u tom
        // trenutku ne vidi nijedan polazak — a to nitko ne prijavi kao grešku
        // nego kao "nema polazaka".
        await getSequelize().transaction(async (t) => {
            await RoutesModel.destroy({
                where: {
                    timetable_uuid: response.data.data.timetable_uuid
                },
                transaction: t
            });
            await TimetablePricesModel.destroy({
                where: {
                    timetable_uuid: response.data.data.timetable_uuid
                },
                transaction: t
            });
            await RoutesModel.bulkCreate(response.data.data.routes, { transaction: t })
            await TimetablePricesModel.bulkCreate(response.data.data.prices, { transaction: t })
        });
        return
    } catch (error) {
        console.log(error)
    }
}

const syncAllRoutesDataController = async()=>{
    const { RoutesModel, TimetablePricesModel } = getModels();
    const coreConfigData = await getCoreServiceConfigData() 
    const response = await axios.get(coreConfigData.services.boat.url + '/sales_routes')
    // Namjerno `destroy` umjesto `truncate`: truncate u transakciji zaključa
    // tablicu i čitatelji čekaju, a ovako stari vozni red ostaje vidljiv sve
    // dok se novi ne potvrdi. Punjenje 4000+ ruta traje, pa je razlika između
    // "starih podataka na trenutak" i "nema polazaka" bitna.
    await getSequelize().transaction(async (t) => {
        await RoutesModel.destroy({ where: {}, transaction: t })
        await TimetablePricesModel.destroy({ where: {}, transaction: t })
        await RoutesModel.bulkCreate(response.data.data.routes, { transaction: t })
        await TimetablePricesModel.bulkCreate(response.data.data.prices, { transaction: t })
    });
}

module.exports = {
    syncHarborsDataController,
    syncLinesDataController,
    syncRoutesDataController,
    syncAllRoutesDataController
}