const axios = require('axios');
const { controlServiceURL } = require('../config/config');

let coreConfigData = {};
let integrationsConfigData = {};

const getCoreServiceConfigData = () => coreConfigData;
const getIntegrationsConfigData = () => integrationsConfigData;

const syncCoreServiceConfigData = async () => {
    const resp = await axios.get(controlServiceURL + '/core_services_config');
    coreConfigData = resp.data?.data || {};
};

const syncIntegrationsConfigData = async () => {
    const resp = await axios.get(controlServiceURL + '/integrations_config');
    integrationsConfigData = resp.data?.data || {};
};

module.exports = {
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getIntegrationsConfigData,
    syncIntegrationsConfigData,
};
