const axios = require('axios')
const { getCoreServiceConfigData } = require('../configServices/configSyncController')

const addTerminalSaleController = async (data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData()
        const url = coreConfigData.services.transactions.url + '/add_terminal_sale'
        const response = await axios.post(url, data, { timeout: 30000, validateStatus: () => true })
        return { status: response.status, body: response.data }
    } catch (error) {
        console.log('addTerminalSaleController error:', error?.message || error)
        return { status: 500, body: { data: { message: error.message } } }
    }
}

const finalizeTerminalSaleController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/finalize_terminal_sale';
        const response = await axios.post(url, data, { timeout: 30000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('finalizeTerminalSaleController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const listVoyageTicketsController = async (params) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/tickets_search';
        const response = await axios.get(url, { params, timeout: 30000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('listVoyageTicketsController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const validateTicketController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/validate_ticket';
        const response = await axios.post(url, data, { timeout: 30000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('validateTicketController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

// Blagajna javlja da je ispisala kopiju karte i natrag dobiva redni broj kopije
// i tri znaka koja treba otisnuti. Broj dodjeljuje transactions servis, ne
// uređaj — kopije iste karte znaju izaći s dva mjesta.
const logTicketCopyPrintController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/ticket_copy_prints';
        const response = await axios.post(url, data, { timeout: 15000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('logTicketCopyPrintController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const listBuyersController = async (params) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/buyers';
        const response = await axios.get(url, { params, timeout: 15000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('listBuyersController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const getInvoiceDetailsController = async (invoiceUuid) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/invoice/' + invoiceUuid;
        const response = await axios.get(url, { timeout: 15000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('getInvoiceDetailsController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const cancelTicketsController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/cancel_tickets';
        const response = await axios.post(url, data, { timeout: 15000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('cancelTicketsController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const upsertTerminalShiftController = async (data) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/terminal_shift';
        const response = await axios.post(url, data, { timeout: 15000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('upsertTerminalShiftController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const listShiftsController = async (params) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const url = coreConfigData.services.transactions.url + '/shifts';
        const response = await axios.get(url, { params, timeout: 15000, validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('channel listShiftsController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

module.exports = {
    logTicketCopyPrintController,
    addTerminalSaleController,
    finalizeTerminalSaleController,
    listVoyageTicketsController,
    validateTicketController,
    listBuyersController,
    getInvoiceDetailsController,
    cancelTicketsController,
    upsertTerminalShiftController,
    listShiftsController,
}