const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

// Platni nalozi — evidencija povrata kupcu (SEPA i kartičarske kuće).
// Sve ide u transactions-service,
// ovdje je samo prolaz.

const osnovica = async () => {
    const coreConfigData = await getCoreServiceConfigData();
    return coreConfigData.services.transactions.url;
};

const listPaymentOrdersController = async (params = {}) => {
    try {
        const response = await axios.get((await osnovica()) + '/payment_orders', { params });
        return response.data;
    } catch (error) {
        console.log('listPaymentOrdersController error:', error?.message || error);
        return { status: 500, data: { orders: [], total: 0 } };
    }
};

const getPaymentOrderController = async (payment_order_uuid) => {
    try {
        const response = await axios.get((await osnovica()) + '/payment_order/' + payment_order_uuid);
        return response.data;
    } catch (error) {
        console.log('getPaymentOrderController error:', error?.message || error);
        return { status: 500, data: { order: null, items: [] } };
    }
};

// Datoteka za e-bankarstvo — vraća se kao sirovi odgovor, da se zaglavlja
// (tip sadržaja i ime datoteke) proslijede nepromijenjena.
const getPaymentOrderXmlController = async (payment_order_uuid, params = {}) => {
    return axios.get((await osnovica()) + '/payment_order_xml/' + payment_order_uuid, {
        params,
        responseType: 'arraybuffer',
        validateStatus: () => true,
    });
};

// Zajednički POST prolaz — status i tijelo se vraćaju doslovno, da poruke o
// gresci (zatvoren nalog, neispravan IBAN) dođu do portala nepromijenjene.
const postNalog = async (putanja, data) => {
    try {
        const response = await axios.post((await osnovica()) + putanja, data, { validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('postNalog error:', putanja, error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const createPaymentOrderController = (data) => postNalog('/payment_orders', data);
const setPaymentOrderStatusController = (data) => postNalog('/payment_order_status', data);
const addPaymentOrderItemController = (data) => postNalog('/payment_order_items', data);
const deletePaymentOrderItemController = (data) => postNalog('/payment_order_item_delete', data);

module.exports = {
    listPaymentOrdersController,
    getPaymentOrderController,
    getPaymentOrderXmlController,
    createPaymentOrderController,
    setPaymentOrderStatusController,
    addPaymentOrderItemController,
    deletePaymentOrderItemController,
};
