const axios = require('axios');
const { getCoreServiceConfigData } = require('../controllers/configSyncController');

// Vrste karata koje se ne prodaju na webu (tickets_types.web_sale = false u
// boat servisu, npr. Djelatna karta). Cjenik u web prodaji je kopija bez te
// oznake, pa se popis čita iz boat servisa i drži minutu.
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
        // Boat servis nedostupan: zadnji poznati popis vrijedi dalje, da web
        // prodaja ne stane i da se vrsta „samo za desk" ne pojavi samo zato
        // što boat servis kratko ne odgovara.
        console.log('desktopOnlyTicketTypes: boat servis nedostupan —', err?.message || err);
    }
    return cache.uuids;
};

module.exports = { desktopOnlyTicketTypes };
