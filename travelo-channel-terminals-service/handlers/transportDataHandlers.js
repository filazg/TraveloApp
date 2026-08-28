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

// Polja polaska koja terminal stvarno koristi. Vozni red nosi 31 polje po
// polasku, a mobilna od toga cita dvadesetak — ostalo su unutarnji identifikatori
// i nazivi voznog reda koje nigdje ne prikazuje. Uz 4000 polazaka to je razlika
// od oko megabajta i pol, i toliko manje posla pri upisu u bazu uredaja.
const POLJA_ZA_MOBILNU = [
    'uuid', 'line_uuid', 'line_code', 'line_name',
    'timetable_uuid', 'sequence', 'direction', 'is_active',
    'departure_date', 'departure_time', 'departure', 'arrival',
    'actual_departure', 'actual_arrival',
    'departure_harbor_id', 'departure_harbor_name', 'departure_harbor_order',
    'arrival_harbor_id', 'arrival_harbor_name', 'arrival_harbor_order',
];

const samoPotrebna = (r) => {
    const izlaz = {};
    for (const k of POLJA_ZA_MOBILNU) izlaz[k] = r[k];
    return izlaz;
};

// Polasci koji su prosli terminalu ne trebaju: karta se za njih ne prodaje ni
// ne validira. Datum je tekst "DD/MM/YYYY", pa se usporeduje po dijelovima.
const uBroj = (dmy) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dmy || ''));
    return m ? Number(m[3] + m[2] + m[1]) : 0;
};
const danasBroj = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return Number(`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`);
};

// Kratka memorija posljednjeg slozenog voznog reda, po uredaju. Terminal ga
// osvjezava cesto — pri prijavi, na zahtjev, pri promjeni dana — a svaki put se
// iznova dohvacaju luke, linije, polasci i cjenici iz sales-servisa i filtriraju
// po zabranjenim linijama. Vozni red se ne mijenja u sekundama, pa se minutu
// drzi slozen paket. Izmjena u administraciji tako kasni najvise minutu.
const MEMORIJA_MS = 60 * 1000;
const memorija = new Map();

const transportDataHandlers = async(billingDeviceUuid, opcije = {})=>{
    try {
        const mrsavo = !!opcije.lean
        const kljuc = `${billingDeviceUuid || 'svi'}|${mrsavo ? 'lean' : 'puni'}`
        const zapamceno = memorija.get(kljuc)
        if (zapamceno && (Date.now() - zapamceno.kad) < MEMORIJA_MS) {
            return zapamceno.podaci
        }
        const harborsData = await getHarborsController()
        const linesData = await getLinesController()
        const routesData = await getRoutesController()
        const pricesData = await getPricesController()
        const excluded = await getExcludedLineUuids(billingDeviceUuid)

        const lines = linesData.data.lines || []
        const routes = routesData.data.routes || []
        const prices = pricesData.data.prices || []

        // Mrsavi paket traži mobilna: bez proslih polazaka i bez polja koja
        // ne koristi. Blagajna i dalje dobiva sve, da joj se nista ne promijeni.
        const zaTerminal = (popis) => {
            if (!mrsavo) return popis
            const danas = danasBroj()
            return popis
                .filter((r) => uBroj(r.departure_date) >= danas)
                .map(samoPotrebna)
        }

        if (!excluded.length) {
            const paket = {
                harbors:harborsData.data.harbors,
                lines,
                sales_routes:zaTerminal(routes),
                trips_prices:prices
            }
            memorija.set(kljuc, { kad: Date.now(), podaci: paket })
            return paket
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
        const paket = {
            harbors:harborsData.data.harbors,
            lines:linesForTerminal,
            sales_routes:zaTerminal(routesForTerminal),
            trips_prices:pricesForTerminal
        }
        memorija.set(kljuc, { kad: Date.now(), podaci: paket })
        return paket
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
