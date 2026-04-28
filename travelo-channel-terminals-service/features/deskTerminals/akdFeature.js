const { checkIslandCardController } = require('../../controllers/coreServiceControllers/akdServiceControllers');
const { cancelTicketsController } = require('../../controllers/coreServiceControllers/transactionsServiceControllers');

const handleCheckIslandCardFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await checkIslandCardController(payload);
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

module.exports = { handleCheckIslandCardFeature, handleCancelTicketsFeature };
