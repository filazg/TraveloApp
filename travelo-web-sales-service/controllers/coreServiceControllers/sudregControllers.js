const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

// Proxy prema backoffice-service /sudreg. Izlaže provjeru OIB-a u Sudskom
// registru web frontendu (javna prodaja) kroz vlastiti origin — backoffice ne
// treba biti javan.
//
// Backoffice vraća: { status:200, data:{ result: { found, oib, naziv, ... } } }
// pa se ovdje result raspakira jednu razinu i vrati kao { found, ... }.

// Poziva backoffice GET /sudreg?oib= i vraća response.data (cijeli omot).
const getSudregLookupController = async (oib) => {
    const coreConfig = getCoreServiceConfigData();
    const backofficeUrl = coreConfig?.services?.backoffice?.url;
    if (!backofficeUrl) {
        throw new Error('backoffice service URL not configured');
    }
    const response = await axios.get(`${backofficeUrl}/sudreg`, {
        params: { oib },
        timeout: 8000,
    });
    return response.data;
};

// Route handler za GET /sudreg?oib=
const sudregLookupHandler = async (req, res) => {
    try {
        const oib = String(req.query.oib || '').trim();
        if (!oib) {
            return res.status(400).json({ error: 'oib je obavezan' });
        }
        const data = await getSudregLookupController(oib);
        // Backoffice omota rezultat u data.result — frontendu vraćamo izravno
        // { found, ... } objekt, raspakiran jednu razinu.
        const result = data?.data?.result ?? data?.result ?? data;
        return res.json(result);
    } catch (err) {
        console.log('sudregLookupHandler error:', err?.message || err);
        return res.status(502).json({ error: err?.message || 'sudreg lookup failed' });
    }
};

module.exports = { getSudregLookupController, sudregLookupHandler };
