const { searchTicketsController, cancelTicketsBackendController, transferTicketsBackendController, getTicketsPdfController } = require('../../controllers/coreServiceControllers/transactionsServiceControllers.js/ticketsServiceControllers');

const handleSearchTicketsFeature = async (req, res) => {
    try {
        const raw = await searchTicketsController(req.query || {});
        const payload = raw?.data || { tickets: [], total: 0 };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'tickets',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleCancelTicketsFeature = async (req, res) => {
    const payload = req.body?.body || req.body || {};
    const { status, body } = await cancelTicketsBackendController(payload);
    res.status(status).send(body);
};

const handleGetTicketsPdfFeature = async (req, res) => {
    try {
        const { order_uuid } = req.params;
        const response = await getTicketsPdfController(order_uuid);
        res.status(response.status);
        const ctype = response.headers['content-type'] || 'application/pdf';
        res.setHeader('content-type', ctype);
        if (response.headers['content-disposition']) {
            res.setHeader('content-disposition', response.headers['content-disposition']);
        }
        return res.send(Buffer.from(response.data));
    } catch (error) {
        console.log('handleGetTicketsPdfFeature error:', error?.message || error);
        res.status(500).send('Tickets PDF proxy failed');
    }
};

const handleTransferTicketsFeature = async (req, res) => {
    const payload = req.body?.body || req.body || {};
    const { status, body } = await transferTicketsBackendController(payload);
    res.status(status).send(body);
};
module.exports = { handleSearchTicketsFeature, handleCancelTicketsFeature, handleTransferTicketsFeature, handleGetTicketsPdfFeature };
