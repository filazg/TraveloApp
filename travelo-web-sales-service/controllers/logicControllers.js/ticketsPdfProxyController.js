const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

const ticketsPdfProxyController = async (req, res) => {
    try {
        const order_uuid = req.params.order_uuid;
        const order_uuids = req.query.order_uuids;
        if (!order_uuid && !order_uuids) return res.status(400).send('order_uuid or order_uuids required');

        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        if (!txUrl) return res.status(500).send('transactions URL missing');

        const target = order_uuid
            ? `${txUrl}/tickets_pdf/${order_uuid}`
            : `${txUrl}/tickets_pdf?order_uuids=${encodeURIComponent(order_uuids)}`;

        const response = await axios({
            method: 'get',
            url: target,
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
