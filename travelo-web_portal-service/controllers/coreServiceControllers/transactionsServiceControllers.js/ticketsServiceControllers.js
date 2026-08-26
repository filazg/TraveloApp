const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

const searchTicketsController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/tickets_search',
            { params }
        );
        return response.data;
    } catch (error) {
        console.log('searchTicketsController error:', error?.message || error);
        return { status: 500, data: { tickets: [], total: 0 } };
    }
};

const getTicketsPdfController = async (order_uuid) => {
    const coreConfigData = await getCoreServiceConfigData();
    return axios.get(
        coreConfigData.services.transactions.url + '/tickets_pdf/' + order_uuid,
        { responseType: 'arraybuffer', validateStatus: () => true }
    );
};

const cancelTicketsBackendController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.post(
            coreConfigData.services.transactions.url + '/cancel_tickets',
            data,
            { validateStatus: () => true }
        );
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('cancelTicketsBackendController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

// Prebacivanje karata na drugi polazak — zatvara staru kartu i vezuje je na
// novu. Racun razlike ide odvojeno, kroz uobicajeni put prodaje.
const transferTicketsBackendController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.post(
            coreConfigData.services.transactions.url + '/transfer_tickets',
            data,
            { validateStatus: () => true }
        );
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('transferTicketsBackendController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};
module.exports = { searchTicketsController, cancelTicketsBackendController, transferTicketsBackendController, getTicketsPdfController };
