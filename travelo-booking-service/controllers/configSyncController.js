const axios = require('axios');
const { controlServiceURL } = require('../config/config');

let coreConfigData = {};
let databaseConfigData = {};

const getCoreServiceConfigData = () => coreConfigData;

const syncCoreServiceConfigData = async () => {
    try {
        const resp = await axios.get(controlServiceURL + '/core_services_config');
        coreConfigData = resp.data?.data || {};
    } catch (error) {
        console.log('syncCoreServiceConfigData error:', error?.message || error);
    }
};

const getDatabaseConfigData = () => databaseConfigData;

const syncDatabaseConfigData = async () => {
    try {
        const resp = await axios.post(controlServiceURL + '/database_services_config', { service: 'booking_service', profile: process.env.TRAVELO_PROFILE });
        databaseConfigData = resp.data || {};
    } catch (error) {
        console.log('syncDatabaseConfigData error:', error?.message || error);
    }
};

module.exports = {
    getCoreServiceConfigData,
    syncCoreServiceConfigData,
    getDatabaseConfigData,
    syncDatabaseConfigData,
};
