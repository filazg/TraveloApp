const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

const handleFinalizeTerminalSaleFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        const resp = await axios.post(`${txUrl}/finalize_terminal_sale`, payload, {
            timeout: 15000,
            validateStatus: () => true,
        });
        res.status(resp.status).send(resp.data);
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetSalesRoutesFeature = async (req, res) => {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const salesUrl = coreConfig?.services?.sales?.url;
        const resp = await axios.get(`${salesUrl}/routes`, { params: req.query, timeout: 10000 });
        const payload = resp.data?.data || { routes: [] };
        res.send({
            status: 200,
            data: { path1: 'salesData', path2: 'routes', data: payload.routes || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetSalesPricesFeature = async (req, res) => {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const salesUrl = coreConfig?.services?.sales?.url;
        const resp = await axios.get(`${salesUrl}/prices`, { params: req.query, timeout: 10000 });
        const payload = resp.data?.data || { prices: [] };
        res.send({
            status: 200,
            data: { path1: 'salesData', path2: 'prices', data: payload.prices || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

module.exports = {
    handleFinalizeTerminalSaleFeature,
    handleGetSalesRoutesFeature,
    handleGetSalesPricesFeature,
};
