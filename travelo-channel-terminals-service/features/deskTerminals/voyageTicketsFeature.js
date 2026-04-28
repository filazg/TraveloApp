const {
    listVoyageTicketsController,
    validateTicketController,
    listBuyersController,
} = require("../../controllers/coreServiceControllers/transactionsServiceControllers");

// GET — vraća sve aktivne karte za odabrani polazak (svi prodajni kanali).
// Mobile poziva ovo prilikom ulaska u Validaciju da bi imao lokalnu listu
// za scan-lookup čak i bez veze.
// Query: date=DD/MM/YYYY (ili ISO), route_uuids=csv, line_code (opc.).
const handleVoyageTicketsFeature = async (req, res) => {
    try {
        const { status, body } = await listVoyageTicketsController(req.query || {});
        res.status(status).send(body);
    } catch (error) {
        console.log("handleVoyageTicketsFeature error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// POST — označi kartu validiranom. Body: { ticket_uuid|ticket_code, terminal_uuid, operator }.
const handleValidateTicketFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await validateTicketController(payload);
        res.status(status).send(body);
    } catch (error) {
        console.log("handleValidateTicketFeature error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleBuyersListFeature = async (req, res) => {
    try {
        const { status, body } = await listBuyersController(req.query || {});
        res.status(status).send(body);
    } catch (error) {
        console.log("handleBuyersListFeature error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { handleVoyageTicketsFeature, handleValidateTicketFeature, handleBuyersListFeature };
