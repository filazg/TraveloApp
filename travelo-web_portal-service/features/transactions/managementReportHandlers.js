const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

const handleGetManagementReportFeature = async (req, res) => {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        const resp = await axios.get(`${txUrl}/management_report`, { params: req.query, timeout: 30000, validateStatus: () => true });
        const payload = resp.data?.data || {};
        res.send({
            status: 200,
            data: payload,
        });
    } catch (error) {
        console.log('handleGetManagementReportFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { handleGetManagementReportFeature };
