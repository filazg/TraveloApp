const { finalizeTerminalSaleController } = require("../../controllers/coreServiceControllers/transactionsServiceControllers");

// Mobile terminals (Sunmi) hit this to finalize a POS sale.
// Body is the same shape transactions-service /finalize_terminal_sale expects.
// Gateway has already validated the terminal token and wraps body as {header, body}.
const handleFinalizeSaleFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await finalizeTerminalSaleController(payload);
        res.status(status).send(body);
    } catch (error) {
        console.log('handleFinalizeSaleFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { handleFinalizeSaleFeature };
