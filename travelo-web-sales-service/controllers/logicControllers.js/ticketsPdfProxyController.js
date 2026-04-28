const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

const ticketsPdfProxyController = async (req, res) => {
    try {
        const order_uuid = req.params.order_uuid;
        if (!order_uuid) return res.status(400).send('order_uuid required');

        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        if (!txUrl) return res.status(500).send('transactions URL missing');

        const response = await axios({
            method: 'get',
            url: `${txUrl}/tickets_pdf/${order_uuid}`,
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
        console.log('ticketsPdfProxyController error:', error?.message || error);
        return res.status(500).send('PDF proxy failed');
    }
};

module.exports = { ticketsPdfProxyController };
