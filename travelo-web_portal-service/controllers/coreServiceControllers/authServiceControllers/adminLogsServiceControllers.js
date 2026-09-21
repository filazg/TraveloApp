const axios = require('axios');
const { getMainServiceConfigData } = require('../../configServices/configSyncController');

// auth-service je u main_services (port 5200). Read endpointi su interni
// (server-to-server); pristup na razini korisnika ograničava BFF handler.
const getLoginLogsController = async (limit) => {
    const main = getMainServiceConfigData();
    const resp = await axios.get(main.services.auth.url + '/admin/login_logs', {
        params: limit ? { limit } : undefined,
    });
    return resp.data; // { logs: [...] }
};

const getDeviceConnectionsController = async () => {
    const main = getMainServiceConfigData();
    const resp = await axios.get(main.services.auth.url + '/admin/device_connections');
    return resp.data; // { devices: [...] }
};

module.exports = { getLoginLogsController, getDeviceConnectionsController };
