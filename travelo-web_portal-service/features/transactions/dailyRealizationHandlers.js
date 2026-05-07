const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

const handleGetDailyRealizationFeature = async (req, res) => {
    try {
        const txUrl = getCoreServiceConfigData()?.services?.transactions?.url;
        const resp = await axios.get(`${txUrl}/daily_realization`, {
            params: req.query,
            timeout: 60000,
            validateStatus: () => true,
        });
        const payload = resp.data?.data || resp.data || {};
        res.send({ status: 200, data: payload });
    } catch (error) {
        console.log('handleGetDailyRealizationFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleSendDailyRealizationToErpFeature = async (req, res) => {
    try {
        const txUrl = getCoreServiceConfigData()?.services?.transactions?.url;
        const resp = await axios.post(`${txUrl}/daily_realization/send_to_erp`, req.body, {
            timeout: 60000,
            validateStatus: () => true,
        });
        res.status(resp.status).send(resp.data);
    } catch (error) {
        console.log('handleSendDailyRealizationToErpFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleGetDailyRealizationDemoFeature = async (req, res) => {
    try {
        const txUrl = getCoreServiceConfigData()?.services?.transactions?.url;
        const resp = await axios.get(`${txUrl}/daily_realization_demo`, {
            params: req.query,
            timeout: 60000,
            validateStatus: () => true,
        });
        const payload = resp.data?.data || resp.data || {};
        res.send({ status: 200, data: payload });
    } catch (error) {
        console.log('handleGetDailyRealizationDemoFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleSendDailyRealizationDemoToErpFeature = async (req, res) => {
    try {
        const txUrl = getCoreServiceConfigData()?.services?.transactions?.url;
        const resp = await axios.post(`${txUrl}/daily_realization_demo/send_to_erp`, req.body, {
            timeout: 60000,
            validateStatus: () => true,
        });
        res.status(resp.status).send(resp.data);
    } catch (error) {
        console.log('handleSendDailyRealizationDemoToErpFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    handleGetDailyRealizationFeature,
    handleSendDailyRealizationToErpFeature,
    handleGetDailyRealizationDemoFeature,
    handleSendDailyRealizationDemoToErpFeature,
};
