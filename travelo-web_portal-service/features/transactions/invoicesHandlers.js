const {
    getInvoicesController,
    getInvoicePdfController,
    getInvoiceDetailsController,
    emailInvoiceTicketsController,
} = require('../../controllers/coreServiceControllers/transactionsServiceControllers.js/invoicesServiceControllers');

const handleGetInvoicesFeature = async (req, res) => {
    try {
        const raw = await getInvoicesController(req.query || {});
        // transactions-service returns {status, data:{invoices, total, limit, offset}}
        const payload = raw?.data || { invoices: [], total: 0 };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'invoices',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetInvoicePdfFeature = async (req, res) => {
    try {
        const { invoice_uuid } = req.params;
        const response = await getInvoicePdfController(invoice_uuid);
        res.status(response.status);
        const ctype = response.headers['content-type'] || 'application/pdf';
        res.setHeader('content-type', ctype);
        if (response.headers['content-disposition']) {
            res.setHeader('content-disposition', response.headers['content-disposition']);
        }
        return res.send(Buffer.from(response.data));
    } catch (error) {
        console.log('handleGetInvoicePdfFeature error:', error?.message || error);
        res.status(500).send('Invoice PDF proxy failed');
    }
};

const handleGetInvoiceDetailsFeature = async (req, res) => {
    try {
        const raw = await getInvoiceDetailsController(req.params.invoice_uuid);
        const payload = raw?.data || { invoice: null, items: [], details: [] };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'invoiceDetails',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleEmailInvoiceTicketsFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await emailInvoiceTicketsController(payload);
        res.status(status).send(body);
    } catch (error) {
        console.log('handleEmailInvoiceTicketsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    handleGetInvoicesFeature,
    handleGetInvoicePdfFeature,
    handleGetInvoiceDetailsFeature,
    handleEmailInvoiceTicketsFeature,
};
