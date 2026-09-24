const axios = require('axios');
const { getCoreServiceConfigData } = require('../controllers/configSyncController');

// Zapis poziva prema AKD-u.
//
// Ovaj servis nema svoju bazu niti je treba — posrednik je prema AKD-u, a ne
// mjesto gdje podaci žive. Zapis zato ide u boat servis, uz ostale SEOP
// postavke, jednim POST-om.
//
// Best-effort i namjerno bez `await` na pozivnom mjestu: razgovor s AKD-om ne
// smije ni zakasniti ni pasti zato što se log nije zapisao. Neuspjeh ide u
// konzolu i tu završava.
const zapisiPoziv = (zapis) => {
    try {
        const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
        if (!boatUrl) return;
        axios.post(`${boatUrl}/akd_logs`, zapis, { timeout: 5000, validateStatus: () => true })
            .catch((e) => console.log('[akd-log] zapis nije uspio:', e?.message || e));
    } catch (e) {
        console.log('[akd-log] zapis nije uspio:', e?.message || e);
    }
};

// Kontekst poziva (tko ga je izazvao i na koju se iskaznicu odnosi) ne zna
// SOAP sloj nego onaj iznad njega. Prenosi se kroz `callSeop`, pa se ovdje samo
// prepisuje u oblik koji zapis očekuje.
const kontekstZapisa = (kontekst = {}) => ({
    terminal_uuid: kontekst.terminal_uuid || null,
    terminal_tid: kontekst.terminal_tid || null,
    terminal_naziv: kontekst.terminal_naziv || null,
    izvor: kontekst.izvor || (kontekst.terminal_uuid ? 'terminal' : 'servis'),
    iskaznica: kontekst.iskaznica || null,
    id_vrsta: kontekst.id_vrsta || null,
    line_no: kontekst.line_no || null,
    relacija: kontekst.relacija || null,
});

module.exports = { zapisiPoziv, kontekstZapisa };
