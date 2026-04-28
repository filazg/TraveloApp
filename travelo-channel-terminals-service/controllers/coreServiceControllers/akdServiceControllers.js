const axios = require('axios');
const { getCoreServiceConfigData } = require('../configServices/configSyncController');

// Proxy: terminal/check_island_card → akd-service /seop/provjeri-ppp.
// Tijelo: { card_no, route: { line_no, departure_harbor_code, arrival_harbor_code }, date }
const checkIslandCardController = async (data) => {
    try {
        const cardNo = String(data?.card_no || '').trim();
        if (!cardNo) {
            return { status: 400, body: { status: 400, data: { message: 'card_no is required' } } };
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
        const response = await axios.post(`${akdUrl}/seop/provjeri-ppp`, {
            sBrOtIs: cardNo,
            oznLuke1: route.departure_harbor_code,
            oznLuke2: route.arrival_harbor_code,
            brLinije: String(route.line_no),
            datPut: data?.date || new Date().toISOString(),
        }, { timeout: 8000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('checkIslandCardController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

module.exports = { checkIslandCardController };
