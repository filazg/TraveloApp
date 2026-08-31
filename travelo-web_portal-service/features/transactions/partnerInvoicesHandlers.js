const {
    getPartnerInvoicesController,
    getPartnerInvoiceDetailsController,
    getPartnerCommissionController,
    getPartnerCommissionDetailsController,
    getPartnerInvoicePdfController,
    getCommissionReportPdfController,
    getPartnerCommissionReportsController,
    getPartnerCommissionReportDetailsController,
} = require('../../controllers/coreServiceControllers/transactionsServiceControllers.js/partnerInvoicesServiceControllers');

const handleGetPartnerInvoicesFeature = async (req, res) => {
    try {
        const raw = await getPartnerInvoicesController(req.query || {});
        const payload = raw?.data || { invoices: [], total: 0 };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'partnerInvoices',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetPartnerInvoiceDetailsFeature = async (req, res) => {
    try {
        const raw = await getPartnerInvoiceDetailsController(req.params.partner_invoice_uuid);
        const payload = raw?.data || { invoice: null, items: [] };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'partnerInvoiceDetails',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetPartnerCommissionFeature = async (req, res) => {
    try {
        const raw = await getPartnerCommissionController(req.query || {});
        const payload = raw?.data || { partners: [], totals: { tickets: 0, gross: 0, base: 0, commission: 0 } };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'partnerCommission',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetPartnerCommissionDetailsFeature = async (req, res) => {
    try {
        const raw = await getPartnerCommissionDetailsController(req.query || {});
        const payload = raw?.data || { rows: [] };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'partnerCommissionDetails',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetPartnerInvoicePdfFeature = (detalji) => async (req, res) => {
    try {
        const { partner_invoice_uuid } = req.params;
        const response = await getPartnerInvoicePdfController(partner_invoice_uuid, detalji);
        res.status(response.status);
        res.setHeader('content-type', response.headers['content-type'] || 'application/pdf');
        if (response.headers['content-disposition']) {
            res.setHeader('content-disposition', response.headers['content-disposition']);
        }
        return res.send(Buffer.from(response.data));
    } catch (error) {
        console.log('handleGetPartnerInvoicePdfFeature error:', error?.message || error);
        res.status(500).send('Partner invoice PDF proxy failed');
    }
};

const handleGetCommissionReportPdfFeature = (detalji) => async (req, res) => {
    try {
        const response = await getCommissionReportPdfController(req.query || {}, detalji);
        res.status(response.status);
        res.setHeader('content-type', response.headers['content-type'] || 'application/pdf');
        if (response.headers['content-disposition']) {
            res.setHeader('content-disposition', response.headers['content-disposition']);
        }
        return res.send(Buffer.from(response.data));
    } catch (error) {
        console.log('handleGetCommissionReportPdfFeature error:', error?.message || error);
        res.status(500).send('Commission report PDF proxy failed');
    }
};

// Generirani izvjestaji za proviziju — lista i pojedinacni sa stavkama.
const handleGetPartnerCommissionReportsFeature = async (req, res) => {
    try {
        const raw = await getPartnerCommissionReportsController(req.query || {});
        const payload = raw?.data || { reports: [], totals: { tickets: 0, gross: 0, base: 0, commission: 0 } };
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'partnerCommissionGenerated',
                data: payload,
            },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetPartnerCommissionReportDetailsFeature = async (req, res) => {
    try {
        const raw = await getPartnerCommissionReportDetailsController(req.params.report_uuid);
        if (!raw) return res.status(404).send({ status: 404, error: 'izvjestaj nije pronaden' });
        res.send({ status: 200, data: raw.data });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

module.exports = {
    handleGetPartnerCommissionReportsFeature,
    handleGetPartnerCommissionReportDetailsFeature,
    handleGetCommissionReportPdfFeature,
    handleGetPartnerInvoicePdfFeature,
    handleGetPartnerInvoicesFeature,
    handleGetPartnerInvoiceDetailsFeature,
    handleGetPartnerCommissionFeature,
    handleGetPartnerCommissionDetailsFeature,
};
