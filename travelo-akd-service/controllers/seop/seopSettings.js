const axios = require('axios');
const { getCoreServiceConfigData, getIntegrationsConfigData } = require('../configSyncController');
const { dohvatiOibTvrtke } = require('../oibTvrtke');

// Postavke SEOP veze. Izvor je boat servis (tablica `seop_settings`), koju ured
// uređuje u portalu; `integrations_configs.json` ostaje samo kao zatečena
// vrijednost za instalacije koje tablicu još nemaju.
//
// Drži se kratkotrajno u memoriji: dojave se šalju u nizu, pa bi svaka od njih
// inače značila još jedan poziv prema boat servisu. Deset sekundi je dovoljno
// da promjena iz portala proradi bez restarta, a da se ne pita u krug.
const TRAJANJE_MS = 10000;

let spremljeno = null;
let spremljenoU = 0;

const izConfiga = () => {
    const cfg = getIntegrationsConfigData()?.akd?.seop || {};
    return {
        environment: cfg.environment || 'mock',
        brodarev_oib: cfg.brodarev_oib || null,
        lozinka: cfg.lozinka || null,
        enabled: false,
        send_opk: true,
        send_ppk: true,
        send_cvikanje_obicna: true,
        send_cvikanje_povlastena: true,
        send_storno: true,
        send_isplovljenje: false,
        send_ponisti_cvikanje_obicna: false,
        send_ponisti_cvikanje_povlastena: false,
        send_from_date: null,
        ozn_pristup_tocke_source: 'billing_device',
        ozn_pristup_tocke_fixed: null,
        line_no_source: 'line_code',
        jop_source: 'departure_uuid',
        p12_file: cfg.p12_path || null,
        p12_password: cfg.p12_password || '',
        ca_file: cfg.akd_ca_cert_path || null,
        sign_cert_file: cfg.seop_sign_cert_path || null,
        tls_reject_unauthorized: cfg.tls_reject_unauthorized === true,
        _izvor: 'config',
    };
};

async function dohvatiPostavke({ svjeze = false } = {}) {
    if (!svjeze && spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;

    const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
    if (boatUrl) {
        try {
            const r = await axios.get(`${boatUrl}/seop_settings/internal`, {
                timeout: 8000,
                validateStatus: () => true,
            });
            const s = r.status === 200 ? (r.data?.data?.settings || null) : null;
            if (s) {
                // OIB brodara nije postavka integracije nego podatak tvrtke.
                const oib = await dohvatiOibTvrtke();
                spremljeno = { ...s, brodarev_oib: oib || s.brodarev_oib || null, _izvor: 'baza' };
                spremljenoU = Date.now();
                return spremljeno;
            }
        } catch (e) {
            console.log('[seopSettings] boat servis nije odgovorio:', e?.message || e);
        }
    }

    // Bez baze se radi po zatečenoj datoteci — ali se ne pamti dugo, da se
    // prijelaz na bazu dogodi čim boat servis proradi.
    spremljeno = izConfiga();
    spremljenoU = Date.now();
    return spremljeno;
}

// Poziva se nakon uploada certifikata ili spremanja postavki, da idući poziv
// ne radi po starom.
function ocistiSpremnik() {
    spremljeno = null;
    spremljenoU = 0;
}

// URL prema okolini. `mock` nema svoj URL — u toj okolini se ništa ne šalje.
function urlZaOkolinu(postavke) {
    const cfg = getIntegrationsConfigData()?.akd?.seop || {};
    return postavke.environment === 'prod' ? cfg.url_prod : cfg.url_test;
}

// Smije li se konkretna dojava poslati. Jedno mjesto za sve provjere, da se
// prekidači ne tumače različito na dva kraja.
function smijeSlati(postavke, metoda, { povlastena = false } = {}) {
    if (!postavke?.enabled) return { smije: false, razlog: 'SEOP dojava je isključena u postavkama' };
    if (postavke.environment === 'mock') return { smije: false, razlog: 'okolina je mock' };
    let prekidac = {
        DojaviProdajuOPKEur: 'send_opk',
        DojaviProdajuOPKKn: 'send_opk',
        DojaviProdajuPPK_3Eur: 'send_ppk',
        DojaviProdajuPPK_3Kn: 'send_ppk',
        Storno: 'send_storno',
        DojaviIsplovljenje: 'send_isplovljenje',
    }[metoda];
    // Cvikanje i poništenje cvika imaju zaseban prekidač za običnu i povlaštenu
    // kartu — sama SEOP metoda je ista, ali brodar smije uključiti samo jednu
    // vrstu (npr. dok se povlaštene tek uvode).
    if (metoda === 'DojaviCvikanje') prekidac = povlastena ? 'send_cvikanje_povlastena' : 'send_cvikanje_obicna';
    if (metoda === 'PonistiCvikanjePojedinacna') prekidac = povlastena ? 'send_ponisti_cvikanje_povlastena' : 'send_ponisti_cvikanje_obicna';
    if (prekidac && postavke[prekidac] === false) {
        return { smije: false, razlog: `dojava ${metoda} je isključena u postavkama` };
    }
    return { smije: true };
}

module.exports = { dohvatiPostavke, ocistiSpremnik, urlZaOkolinu, smijeSlati };
