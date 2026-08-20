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

// PDF se prosljeđuje kao sirovi buffer da zaglavlja (content-type i ime
// datoteke iz content-disposition) dođu do preglednika nedirnuta.
const handleGetHarborTaxReportPdfFeature = async (req, res) => {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        const resp = await axios.get(`${txUrl}/harbor_tax_report_pdf`, {
            params: req.query,
            responseType: 'arraybuffer',
            validateStatus: () => true,
            timeout: 60000,
        });
        res.status(resp.status);
        res.setHeader('content-type', resp.headers['content-type'] || 'application/pdf');
        if (resp.headers['content-disposition']) {
            res.setHeader('content-disposition', resp.headers['content-disposition']);
        }
        return res.send(Buffer.from(resp.data));
    } catch (error) {
        console.log('handleGetHarborTaxReportPdfFeature error:', error?.message || error);
        res.status(500).send('Harbor tax PDF proxy failed');
    }
};

module.exports = { handleGetHarborTaxReportFeature, handleGetHarborTaxReportPdfFeature };
