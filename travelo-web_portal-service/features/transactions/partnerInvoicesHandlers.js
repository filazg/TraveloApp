const {
    getPartnerInvoicesController,
    getPartnerInvoiceDetailsController,
    getPartnerCommissionController,
    getPartnerCommissionDetailsController,
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

module.exports = {
    handleGetPartnerInvoicesFeature,
    handleGetPartnerInvoiceDetailsFeature,
    handleGetPartnerCommissionFeature,
    handleGetPartnerCommissionDetailsFeature,
};
