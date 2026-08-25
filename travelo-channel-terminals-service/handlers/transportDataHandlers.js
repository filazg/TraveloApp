const { getHarborsController, getLinesController, getRoutesController, getPricesController } = require("../controllers/coreServiceControllers/salesServiceControllers")
const { getBillingDevicesController } = require("../controllers/coreServiceControllers/backofficeServiceControllers")

// Linije koje su naplatnom uređaju zabranjene. Backoffice pamti iznimke, ne
// dozvole — prazna lista (ili uređaj koji se ne nađe) znači da uređaj vidi sve.
// Zato je i ponašanje pri grešci "vidi sve": prodaja ne smije stati zato što
// backoffice trenutno ne odgovara.
const getExcludedLineUuids = async (billingDeviceUuid) => {
    if (!billingDeviceUuid) return []
    try {
        const billingDevicesData = await getBillingDevicesController()
        const terminal = billingDevicesData?.data?.billing_devices?.find((d) => d.uuid === billingDeviceUuid)
        return (terminal?.excluded_lines || []).map((l) => l.uuid).filter(Boolean)
    } catch (error) {
        console.log('[transport_data] dohvat zabranjenih linija pao:', error?.message || error)
        return []
    }
}

const transportDataHandlers = async(billingDeviceUuid)=>{
    try {
        const harborsData = await getHarborsController()
        const linesData = await getLinesController()
        const routesData = await getRoutesController()
        const pricesData = await getPricesController()
        const excluded = await getExcludedLineUuids(billingDeviceUuid)

        const lines = linesData.data.lines || []
        const routes = routesData.data.routes || []
        const prices = pricesData.data.prices || []

        if (!excluded.length) {
            return {
                harbors:harborsData.data.harbors,
                lines,
                sales_routes:routes,
                trips_prices:prices
            }
        }

        const linesForTerminal = lines.filter((l) => !excluded.includes(l.uuid))
        const routesForTerminal = routes.filter((r) => !excluded.includes(r.line_uuid))
        // Cjenici nemaju liniju nego vozni red, pa se zadrže samo oni vozni redovi
        // koji su preživjeli filtriranje polazaka.
        const timetablesForTerminal = new Set(routesForTerminal.map((r) => r.timetable_uuid))
        const pricesForTerminal = prices.filter((p) => timetablesForTerminal.has(p.timetable_uuid))

        console.log('[transport_data] uređaj', billingDeviceUuid,
            '| zabranjenih linija:', excluded.length,
            '| linije:', linesForTerminal.length + '/' + lines.length,
            '| polasci:', routesForTerminal.length + '/' + routes.length)

        // Luke se ne filtriraju — terminal ih koristi i za validaciju karata
        // prodanih drugdje, pa bi mu skraćeni šifarnik razbio prikaz.
        return {
            harbors:harborsData.data.harbors,
            lines:linesForTerminal,
            sales_routes:routesForTerminal,
            trips_prices:pricesForTerminal
        }
    } catch (error) {
        console.log(error)
        return
    }
}

module.exports = {
    transportDataHandlers
}
