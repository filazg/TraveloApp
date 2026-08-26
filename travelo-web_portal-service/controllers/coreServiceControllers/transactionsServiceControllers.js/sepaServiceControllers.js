const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

// SEPA nalozi — evidencija povrata na račun. Sve ide u transactions-service,
// ovdje je samo prolaz.

const osnovica = async () => {
    const coreConfigData = await getCoreServiceConfigData();
    return coreConfigData.services.transactions.url;
};

const listSepaOrdersController = async (params = {}) => {
    try {
        const response = await axios.get((await osnovica()) + '/sepa_orders', { params });
        return response.data;
    } catch (error) {
        console.log('listSepaOrdersController error:', error?.message || error);
        return { status: 500, data: { orders: [], total: 0 } };
    }
};

const getSepaOrderController = async (sepa_order_uuid) => {
    try {
        const response = await axios.get((await osnovica()) + '/sepa_order/' + sepa_order_uuid);
        return response.data;
    } catch (error) {
        console.log('getSepaOrderController error:', error?.message || error);
        return { status: 500, data: { order: null, items: [] } };
    }
};

// Zajednički POST prolaz — status i tijelo se vraćaju doslovno, da poruke o
// gresci (zatvoren nalog, neispravan IBAN) dođu do portala nepromijenjene.
const postSepa = async (putanja, data) => {
    try {
        const response = await axios.post((await osnovica()) + putanja, data, { validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('postSepa error:', putanja, error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const createSepaOrderController = (data) => postSepa('/sepa_orders', data);
const setSepaOrderStatusController = (data) => postSepa('/sepa_order_status', data);
const addSepaOrderItemController = (data) => postSepa('/sepa_order_items', data);
const deleteSepaOrderItemController = (data) => postSepa('/sepa_order_item_delete', data);

module.exports = {
    listSepaOrdersController,
    getSepaOrderController,
    createSepaOrderController,
    setSepaOrderStatusController,
    addSepaOrderItemController,
    deleteSepaOrderItemController,
};
