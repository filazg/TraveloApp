const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

const getInvoicesController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/invoices',
            { params }
        );
        return response.data;
    } catch (error) {
        console.log('getInvoicesController error:', error?.message || error);
        return { invoices: [], total: 0 };
    }
};

const getInvoiceDetailsController = async (invoice_uuid) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/invoice/' + invoice_uuid
        );
        return response.data;
    } catch (error) {
        console.log('getInvoiceDetailsController error:', error?.message || error);
        return null;
    }
};

// Streams PDF from transactions-service as a raw buffer (content-type preserved).
const getInvoicePdfController = async (invoice_uuid) => {
    const coreConfigData = await getCoreServiceConfigData();
    return axios.get(
        coreConfigData.services.transactions.url + '/invoice_pdf/' + invoice_uuid,
        { responseType: 'arraybuffer', validateStatus: () => true }
    );
};

const emailInvoiceTicketsController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.post(
            coreConfigData.services.transactions.url + '/email_invoice_tickets',
            data,
            { validateStatus: () => true }
        );
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('emailInvoiceTicketsController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

module.exports = {
    getInvoicesController,
    getInvoicePdfController,
    getInvoiceDetailsController,
    emailInvoiceTicketsController,
};
