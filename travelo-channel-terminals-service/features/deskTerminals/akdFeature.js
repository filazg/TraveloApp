const { checkIslandCardController } = require('../../controllers/coreServiceControllers/akdServiceControllers');
const { cancelTicketsController, stornoCheckController } = require('../../controllers/coreServiceControllers/transactionsServiceControllers');

const handleCheckIslandCardFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        // Uredaj je poznat samo ovdje: gateway u zaglavlje stavi sadrzaj tokena,
        // a uredaj svoj uuid ne salje u tijelu. Bez toga se u AKD logu ne bi
        // znalo s koje je blagajne provjera krenula.
        const terminalUuid = req.body?.header?.data?.t || null;
        const { status, body } = await checkIslandCardController({ ...payload, terminal_uuid: terminalUuid });
        res.status(status).send(body);
    } catch (error) {
        console.log('handleCheckIslandCardFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleCancelTicketsFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await cancelTicketsController(payload);
        res.status(status).send(body);
    } catch (error) {
        console.log('handleCancelTicketsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Uređaj ne šalje svoj uuid u tijelu provjere — zna se iz tokena (zaglavlje
// koje postavlja gateway), a treba za zapis pokušaja u Kontroli.
const handleStornoCheckFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const terminalUuid = payload.terminal_uuid || req.body?.header?.data?.t || null;
        const { status, body } = await stornoCheckController({ ...payload, terminal_uuid: terminalUuid });
        res.status(status).send(body);
    } catch (error) {
        console.log('handleStornoCheckFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { handleCheckIslandCardFeature, handleCancelTicketsFeature, handleStornoCheckFeature };
