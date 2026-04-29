const axios = require('axios');
const { getCoreServiceConfigData } = require("../configServices/configSyncController");

const apiCreateOrder = async (data) => {
    const coreConfigData = await getCoreServiceConfigData();
    const response = await axios.post(coreConfigData.services.transactions.url + '/api_create_order', data);
    return response.data;
};

const apiConfirmOrder = async (data) => {
    const coreConfigData = await getCoreServiceConfigData();
    const response = await axios.post(coreConfigData.services.transactions.url + '/api_confirm_order', data);
    return response.data;
};

const apiCancelOrder = async (data) => {
    const coreConfigData = await getCoreServiceConfigData();
    const response = await axios.post(coreConfigData.services.transactions.url + '/api_cancel_order', data);
    return response.data;
};

const apiGetTripDetails = async (data) => {
    const coreConfigData = await getCoreServiceConfigData();
    const response = await axios.post(coreConfigData.services.transactions.url + '/api_trip_details', data);
    return response.data;
};

const apiGetOrderTotal = async (order_uuid) => {
    const coreConfigData = await getCoreServiceConfigData();
    const response = await axios.post(coreConfigData.services.transactions.url + '/api_get_order', { order_uuid });
    return response.data;
};

module.exports = {
    apiCreateOrder,
    apiConfirmOrder,
    apiCancelOrder,
    apiGetTripDetails,
    apiGetOrderTotal,
};
