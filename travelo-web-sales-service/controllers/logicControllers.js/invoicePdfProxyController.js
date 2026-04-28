const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

const invoicePdfProxyController = async (req, res) => {
    try {
        const invoice_uuid = req.params.invoice_uuid;
        if (!invoice_uuid) return res.status(400).send('invoice_uuid required');

        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        if (!txUrl) return res.status(500).send('transactions URL missing');

        const response = await axios({
            method: 'get',
            url: `${txUrl}/invoice_pdf/${invoice_uuid}`,
            responseType: 'arraybuffer',
            validateStatus: () => true,
        });

        res.status(response.status);
        const ctype = response.headers['content-type'] || 'application/pdf';
        res.setHeader('content-type', ctype);
        if (response.headers['content-disposition']) {
            res.setHeader('content-disposition', response.headers['content-disposition']);
        }
        return res.send(Buffer.from(response.data));
    } catch (error) {
        console.log('invoicePdfProxyController error:', error?.message || error);
        return res.status(500).send('Invoice PDF proxy failed');
    }
};

module.exports = { invoicePdfProxyController };
