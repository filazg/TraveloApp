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

// Obracun provizije partnerima koji prodaju u nase ime — poseban put od
// partnerskih racuna, jer je i smjer novca suprotan.
const getPartnerCommissionController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/partner_commission',
            { params }
        );
        return response.data;
    } catch (error) {
        console.log('getPartnerCommissionController error:', error?.message || error);
        return { data: { partners: [], totals: { tickets: 0, gross: 0, base: 0, commission: 0 } } };
    }
};

module.exports = {
    getPartnerInvoicesController,
    getPartnerInvoiceDetailsController,
    getPartnerCommissionController,
};
