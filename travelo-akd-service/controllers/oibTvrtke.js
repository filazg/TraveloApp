const axios = require('axios');
const { getCoreServiceConfigData } = require('./configSyncController');

// OIB brodara prema AKD-u je OIB same tvrtke — isti onaj koji stoji u
// Administracija → Tvrtka i ispisuje se na svakom računu. Zato se ne upisuje
// drugi put u postavkama integracije: dva mjesta za isti podatak znače i dva
// mjesta na kojima može biti krivo, a SEOP korisničko ime veže uz taj OIB.
//
// Drži se kratko u memoriji: dojave idu u nizu, a OIB se ne mijenja.
const TRAJANJE_MS = 60000;

let spremljeno = null;
let spremljenoU = 0;

async function dohvatiOibTvrtke({ svjeze = false } = {}) {
    if (!svjeze && spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;

    const url = getCoreServiceConfigData()?.services?.backoffice?.url;
    if (!url) return null;
    try {
        const r = await axios.get(`${url}/company`, { timeout: 8000, validateStatus: () => true });
        const oib = r.status === 200 ? (r.data?.data?.company?.legal_id || null) : null;
        if (oib) {
            spremljeno = String(oib).trim();
            spremljenoU = Date.now();
        }
        return spremljeno;
    } catch (e) {
        console.log('[oibTvrtke] backoffice nije odgovorio:', e?.message || e);
        return spremljeno;
    }
}

module.exports = { dohvatiOibTvrtke };
