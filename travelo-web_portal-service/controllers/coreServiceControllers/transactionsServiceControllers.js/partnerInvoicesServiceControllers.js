const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

const getPartnerInvoicesController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/partner_invoices',
            { params }
        );
        return response.data;
    } catch (error) {
        console.log('getPartnerInvoicesController error:', error?.message || error);
        return { invoices: [], total: 0 };
    }
};

const getPartnerInvoiceDetailsController = async (partner_invoice_uuid) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/partner_invoice/' + partner_invoice_uuid
        );
        return response.data;
    } catch (error) {
        console.log('getPartnerInvoiceDetailsController error:', error?.message || error);
        return null;
    }
};

module.exports = {
    getPartnerInvoicesController,
    getPartnerInvoiceDetailsController,
};
