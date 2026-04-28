const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

const handleGetHarborTaxReportFeature = async (req, res) => {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        const resp = await axios.get(`${txUrl}/harbor_tax_report`, { params: req.query, timeout: 20000 });
        const payload = resp.data?.data || {};
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'harborTaxReport',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

module.exports = { handleGetHarborTaxReportFeature };
