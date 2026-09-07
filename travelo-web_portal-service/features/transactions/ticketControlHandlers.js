const {
    getTicketCopyConflictsController,
    getTicketValidationsController,
    getTicketCopyPrintsController,
} = require('../../controllers/coreServiceControllers/transactionsServiceControllers.js/ticketControlServiceControllers');

// Modul KONTROLA → kartica "Kontrola kopija karata".
//
// Tri pogleda na isti posao: sukobi po karti (što se gleda prvo), pokušaji
// validacije (povijest jedne karte) i evidentirani ispisi kopija (odakle je
// kopija došla). Svaki puni svoj ključ u portalu — sukobi i detalj su dva
// različita podatka i ne smiju se pregaziti jedan drugim.

const handleGetTicketCopyConflictsFeature = async (req, res) => {
    try {
        const payload = await getTicketCopyConflictsController(req.query || {});
        res.send({
            status: 200,
            data: { path1: 'kontrolaData', path2: 'copyConflicts', data: payload },
        });
    } catch (error) {
        console.log('handleGetTicketCopyConflictsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleGetTicketValidationsFeature = async (req, res) => {
    try {
        const payload = await getTicketValidationsController(req.query || {});
        res.send({
            status: 200,
            data: { path1: 'kontrolaData', path2: 'validations', data: payload },
        });
    } catch (error) {
        console.log('handleGetTicketValidationsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleGetTicketCopyPrintsFeature = async (req, res) => {
    try {
        const payload = await getTicketCopyPrintsController(req.query || {});
        res.send({
            status: 200,
            data: { path1: 'kontrolaData', path2: 'copyPrints', data: payload },
        });
    } catch (error) {
        console.log('handleGetTicketCopyPrintsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    handleGetTicketCopyConflictsFeature,
    handleGetTicketValidationsFeature,
    handleGetTicketCopyPrintsFeature,
};
