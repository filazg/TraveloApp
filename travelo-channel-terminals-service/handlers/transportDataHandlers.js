const { getHarborsController, getLinesController, getRoutesController, getPricesController } = require("../controllers/coreServiceControllers/salesServiceControllers")
const { getBillingDevicesController } = require("../controllers/coreServiceControllers/backofficeServiceControllers")

// Linije koje su naplatnom uređaju zabranjene. Backoffice pamti iznimke, ne
// dozvole — prazna lista znači da uređaj vidi sve.
//
// Kad backoffice ne odgovori, greška se propušta dalje i vozni red se NE
// isporučuje. Prije se u tom slučaju vraćala prazna lista zabrana, pa je
// uređaj dobio sve linije i spremio ih lokalno — ispao je zabranjeni vozni
// red na terminalu i ostao ondje do sljedećeg uspješnog syncа. Bolje je da
// sync padne i uređaj zadrži prethodnu, ispravno filtriranu kopiju.
const getExcludedLineUuids = async (billingDeviceUuid) => {
    if (!billingDeviceUuid) return []
    const billingDevicesData = await getBillingDevicesController()
    const terminal = billingDevicesData?.data?.billing_devices?.find((d) => d.uuid === billingDeviceUuid)
    if (!terminal) {
        // Uređaj koji backoffice ne poznaje ne smije dobiti tuđi vozni red.
        throw new Error(`naplatni uređaj ${billingDeviceUuid} nije nađen u backofficeu`)
    }
    return (terminal?.excluded_lines || []).map((l) => l.uuid).filter(Boolean)
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
        // Greška se ne guta: dosad se vraćalo `undefined` pa je terminal dobio
        // 200 bez podataka i nije znao da vozni red nije osvježen.
        console.log('[transport_data] neuspjeh:', error?.message || error)
        throw error
    }
}

module.exports = {
    transportDataHandlers
}
