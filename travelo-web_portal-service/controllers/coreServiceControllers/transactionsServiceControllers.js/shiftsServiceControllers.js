const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

const getShiftsController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/shifts',
            { params }
        );
        return response.data;
    } catch (error) {
        console.log('getShiftsController error:', error?.message || error);
        return { data: [] };
    }
};

module.exports = { getShiftsController };
