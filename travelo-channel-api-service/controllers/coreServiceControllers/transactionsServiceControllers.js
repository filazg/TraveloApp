const axios = require('axios');
const { getCoreServiceConfigData } = require("../configServices/configSyncController");

// Jezgra poslovni ishod javlja statusom (404 "Order not found", 409 i slicno), a
// axios po zadanom na 4xx baca. Pozivatelji su pisani da gledaju `result.status`
// — ali do te provjere nikad nisu dolazili, nego su zavrsavali u catchu i
// partneru vracali 500 "Internal error". Zato se status ne tretira kao iznimka
// nego kao podatak, pa 404 ostane 404.
const posalji = async (putanja, tijelo) => {
    const coreConfigData = await getCoreServiceConfigData();
    const response = await axios.post(coreConfigData.services.transactions.url + putanja, tijelo, {
        timeout: 30000,
        validateStatus: () => true,
    });
    return response.data;
};

const apiCreateOrder = (data) => posalji('/api_create_order', data);

const apiConfirmOrder = (data) => posalji('/api_confirm_order', data);

const apiCancelOrder = (data) => posalji('/api_cancel_order', data);

const apiGetTripDetails = (data) => posalji('/api_trip_details', data);

const apiGetOrderTotal = (order_uuid) => posalji('/api_get_order', { order_uuid });

module.exports = {
    apiCreateOrder,
    apiConfirmOrder,
    apiCancelOrder,
    apiGetTripDetails,
    apiGetOrderTotal,
};
