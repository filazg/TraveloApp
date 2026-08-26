const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

const postToTransactions = async (path, body) => {
    const coreConfig = await getCoreServiceConfigData();
    const txUrl = coreConfig?.services?.transactions?.url;
    const resp = await axios.post(`${txUrl}${path}`, body, {
        timeout: 30000,
        validateStatus: () => true,
    });
    return resp;
};

const handleCancelSailingFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const resp = await postToTransactions('/cancel_sailing', payload);
        res.status(resp.status).send(resp.data);
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleSendSailingMessageFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const resp = await postToTransactions('/send_sailing_message', payload);
        res.status(resp.status).send(resp.data);
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

// Vracanje pogresno otkazanog polaska u prodaju. Karte ostaju otkazane.
const handleRestoreSailingFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const resp = await postToTransactions('/restore_sailing', payload);
        res.status(resp.status).send(resp.data);
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};
module.exports = { handleCancelSailingFeature, handleRestoreSailingFeature, handleSendSailingMessageFeature };
