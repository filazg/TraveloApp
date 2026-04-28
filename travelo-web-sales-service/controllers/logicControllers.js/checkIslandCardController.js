const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

// Proxy prema travelo-akd-service ProvjeriPPP. Izlaže ga web frontendu kako
// bi ga mogao zvati kroz vlastiti origin (akd-service ne treba biti javan).
//
// Body iz weba: { card_no, route, date }
//   card_no — sBrOtIs (serijski broj otočne iskaznice; user upisuje broj)
//   route   — { line_no, departure_harbor_code, arrival_harbor_code }
//   date    — ISO datum/vrijeme putovanja
//
// Vraća isti shape kao akd-service: { ima_pravo, popust_postotak, otok, … }

const checkIslandCardController = async (req, res) => {
    try {
        const body = req.body || {};
        const cardNo = String(body.card_no || '').trim();
        if (!cardNo) {
            return res.status(400).json({ status: 400, data: { message: 'card_no je obavezan' } });
        }
        const route = body.route || {};
        if (!route.line_no || !route.departure_harbor_code || !route.arrival_harbor_code) {
            return res.status(400).json({ status: 400, data: { message: 'route.line_no/departure_harbor_code/arrival_harbor_code obavezni' } });
        }
        const dateIso = body.date || new Date().toISOString();

        const core = getCoreServiceConfigData();
        const akdUrl = core?.services?.akd?.url;
        if (!akdUrl) {
            return res.status(500).json({ status: 500, data: { message: 'akd service URL not configured' } });
        }

        const resp = await axios.post(`${akdUrl}/seop/provjeri-ppp`, {
            sBrOtIs: cardNo,
            oznLuke1: route.departure_harbor_code,
            oznLuke2: route.arrival_harbor_code,
            brLinije: String(route.line_no),
            datPut: dateIso,
        }, { timeout: 8000, validateStatus: () => true });

        if (resp.status >= 400) {
            return res.status(resp.status).json({ status: resp.status, data: resp.data?.data || resp.data });
        }
        return res.json(resp.data);
    } catch (err) {
        console.log('checkIslandCardController error:', err?.message || err);
        return res.status(500).json({ status: 500, data: { message: err.message } });
    }
};

module.exports = { checkIslandCardController };
