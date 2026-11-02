const axios = require('axios');
const { getCoreServiceConfigData } = require('../controllers/configSyncController');

// Partnerska prodaja ne nudi otočne karte (pravo se provjerava kroz SEOP) ni
// vrste karata samo za desk (tickets_types.web_sale = false u boat servisu,
// npr. Djelatna karta). Cjenik ovdje nema oznaku „samo desk", pa se popis
// čita iz boat servisa i drži minutu.
const TTL_MS = 60 * 1000;
let cache = { at: 0, uuids: new Set() };

const desktopOnlyTicketTypes = async () => {
    if (Date.now() - cache.at < TTL_MS) return cache.uuids;
    try {
        const core = await getCoreServiceConfigData();
        const resp = await axios.get(`${core.services.boat.url}/tickets_types`, { timeout: 5000 });
        const list = resp.data?.data?.ticketTypes || [];
        cache = { at: Date.now(), uuids: new Set(list.filter((t) => t.web_sale === false).map((t) => t.uuid)) };
    } catch (err) {
        // Boat servis nedostupan: vrijedi zadnji poznati popis.
        console.log('desktopOnlyTicketTypes: boat servis nedostupan —', err?.message || err);
    }
    return cache.uuids;
};

const PARTNER_CHANNEL = 'partner_web';

// Vraća funkciju koja za stavku cjenika kaže smije li je partner prodati.
const partnerSmijeProdati = async () => {
    const samoDesk = await desktopOnlyTicketTypes();
    return (price) => !price?.is_island && !samoDesk.has(price?.ticket_type_uuid);
};

module.exports = { PARTNER_CHANNEL, partnerSmijeProdati };
