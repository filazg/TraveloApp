const { getHarborsController, getLinesController, getRoutesController, getPricesController } = require("../controllers/coreServiceControllers/salesServiceControllers")


const transportDataHandlers = async()=>{
    try {
        const harborsData = await getHarborsController()
        const linesData = await getLinesController()
        const routesData = await getRoutesController()
        const pricesData = await getPricesController()
        console.log('LINES DATA ', linesData.data)
        const dataToSend = {
            harbors:harborsData.data.harbors,
            lines:linesData.data.lines,
            sales_routes:routesData.data.routes,
            trips_prices:pricesData.data.prices
        }
        return (dataToSend)
    } catch (error) {
        console.log(error)
        return
    }
}

module.exports = {
    transportDataHandlers
}