const axios = require('axios');
const { getMainServiceConfigData, getCoreServiceConfigData } = require('../../configServices/configSyncController');

// auth-service je u main_services (port 5200). Read endpointi su interni
// (server-to-server); pristup na razini korisnika ograničava BFF handler.
// Timeout da povremeno spor/zaglavljen auth ne visi u nedogled (portal bi ostao
// na spinneru). Radije brzo padne pa se osvježi.
const AUTH_TIMEOUT_MS = 20000;

const getLoginLogsController = async (limit) => {
    const main = getMainServiceConfigData();
    const resp = await axios.get(main.services.auth.url + '/admin/login_logs', {
        params: limit ? { limit } : undefined,
        timeout: AUTH_TIMEOUT_MS,
    });
    return resp.data; // { logs: [...] }
};

const getDeviceConnectionsController = async () => {
    const main = getMainServiceConfigData();
    const resp = await axios.get(main.services.auth.url + '/admin/device_connections', {
        timeout: AUTH_TIMEOUT_MS,
    });
    return resp.data; // { devices: [...] }
};

// AKD log stoji u boat servisu, uz ostale SEOP postavke — akd servis nema svoju
// bazu. Filtri se prosljeduju kakvi jesu; njih tumaci boat.
const getAkdLogsController = async (params = {}) => {
    const core = getCoreServiceConfigData();
    const resp = await axios.get(core.services.boat.url + '/akd_logs', {
        params,
        timeout: AUTH_TIMEOUT_MS,
    });
    return resp.data?.data || {};
};

module.exports = { getLoginLogsController, getDeviceConnectionsController, getAkdLogsController };
