const axios = require('axios');
const { getCoreServiceConfigData } = require('../configServices/configSyncController');

// Proxy: terminal/check_island_card → akd-service /povlastica/provjeri.
//
// Tijelo koje šalje blagajna:
//   {
//     sustav: 'SEOP' | 'MOSI',                       // izostane li, SEOP
//     card_no | oib | uid | iks | reg_oznaka,        // jedan identifikator
//     route: { line_no, departure_harbor_code, arrival_harbor_code },
//     date,
//     kartica: {...}                                 // ono što je čitač pročitao (MOSI)
//   }
//
// Identifikator je bilo koji od pet. Očitanje čipa daje broj kartice, ali
// specifikacija traži da blagajna radi i kad se čip ne da pročitati — tada
// blagajnik upisuje broj iskaznice, broj iksice ili OIB putnika.
//
// Natrag ide gotova odluka i zapečaćeni zapis (`token`) koji blagajna vraća uz
// prodaju. Blagajna zapis ne čita i ne mijenja; što u njemu treba pisati,
// odlučuje akd servis. Zbog toga dolazak pravih ključeva ne traži novi build
// blagajne ni mobilne.
const PREPISI = [
    ['card_no', 'card_no'],
    ['oib', 'oib'],
    ['uid', 'uid'],
    ['iks', 'iks'],
    ['reg_oznaka', 'reg_oznaka'],
];

const izvadiIdentifikator = (data) => {
    for (const [polje, vrsta] of PREPISI) {
        const v = String(data?.[polje] || '').trim();
        if (v) return { vrsta, vrijednost: v };
    }
    // Noviji klijenti šalju već složen identifikator.
    const i = data?.identifikator;
    if (i?.vrsta && i?.vrijednost) return { vrsta: i.vrsta, vrijednost: String(i.vrijednost).trim() };
    return null;
};

const checkIslandCardController = async (data) => {
    try {
        const identifikator = izvadiIdentifikator(data);
        if (!identifikator) {
            return { status: 400, body: { status: 400, data: { message: 'potreban je broj kartice, OIB, UID čipa, broj iksice ili registarska oznaka' } } };
        }
        const route = data?.route || {};
        if (!route.line_no || !route.departure_harbor_code || !route.arrival_harbor_code) {
            return { status: 400, body: { status: 400, data: { message: 'route.line_no/departure_harbor_code/arrival_harbor_code required' } } };
        }
        const coreConfigData = await getCoreServiceConfigData();
        const akdUrl = coreConfigData?.services?.akd?.url;
        if (!akdUrl) {
            return { status: 500, body: { status: 500, data: { message: 'akd service URL not configured' } } };
        }
        const response = await axios.post(`${akdUrl}/povlastica/provjeri`, {
            sustav: data?.sustav || 'SEOP',
            identifikator,
            ruta: {
                line_no: String(route.line_no),
                departure_harbor_code: route.departure_harbor_code,
                arrival_harbor_code: route.arrival_harbor_code,
            },
            datum: data?.date || new Date().toISOString(),
            kartica: data?.kartica || null,
        }, { timeout: 12000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('checkIslandCardController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

module.exports = { checkIslandCardController };
