const axios = require('axios')
const { getSequelize } = require("../../config/database");
const { getCoreServiceConfigData } = require("../configSyncController");
const { getModels } = require('../../dbModels');

// Zamjena kopije luka ili linija. Brisanje i punjenje su jedan zahvat: dosad je
// truncate prošao, a ako punjenje pukne, tablica je ostala prazna i terminali
// su na sinkronizaciji dobivali plovidbeni red bez ijedne luke i linije.
// Prazan popis iz boat-servisa se ne prepisuje preko postojećeg — brodar bez
// ijedne luke ili linije nije stvarno stanje nego znak da izvor nije odgovorio
// kako treba, pa ostaje zadnja dobra kopija.
const zamijeniKopiju = async (Model, zapisi, naziv) => {
    if (!Array.isArray(zapisi) || !zapisi.length) {
        console.log(`[sync ${naziv}] boat-servis vratio prazan popis — zadržavam postojeću kopiju`)
        return
    }
    await getSequelize().transaction(async (t) => {
        await Model.destroy({ where: {}, transaction: t })
        await Model.bulkCreate(zapisi, { transaction: t })
    });
}

const syncHarborsDataController = async()=>{
    try {
        const { HarborsModel } = getModels();
        const coreConfigData = await getCoreServiceConfigData()
        const response = await axios.get(coreConfigData.services.boat.url + '/harbors')
        await zamijeniKopiju(HarborsModel, response.data?.data?.harbors, 'luke')
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
        await zamijeniKopiju(LinesModel, response.data?.data?.lines, 'linije')
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
        // plovidbeni red tog reda prazan sve dok punjenje traje, pa blagajna u tom
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
    // tablicu i čitatelji čekaju, a ovako stari plovidbeni red ostaje vidljiv sve
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