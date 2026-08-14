const {
    getSailingsController,
    getSailingDetailsController,
    startSailingController,
    updateLegStatusController,
    cancelHarborArrivalController,
    changeBoatController,
} = require('../../controllers/coreServiceControllers/boatServiceControllers.js/sailingServiceControllers');

const handleGetSailingsFeature = async (req, res) => {
    try {
        const raw = await getSailingsController(req.query || {});
        const payload = raw?.data || { sailings: [] };
        res.send({ status: 200, data: payload });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetSailingDetailsFeature = async (req, res) => {
    try {
        const raw = await getSailingDetailsController(req.params.uuid);
        const payload = raw?.data || { sailing: null, legs: [], bookings: [] };
        res.send({ status: 200, data: payload });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleStartSailingFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await startSailingController(payload);
        res.status(status).send(body);
    } catch (error) {
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleUpdateLegStatusFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await updateLegStatusController(payload);
        res.status(status).send(body);
    } catch (error) {
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleCancelHarborArrivalFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await cancelHarborArrivalController(payload);
        res.status(status).send(body);
    } catch (error) {
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleChangeBoatFeature = async (req, res) => {
    try {
        const payload = req.body?.body || req.body || {};
        const { status, body } = await changeBoatController(payload);
        res.status(status).send(body);
    } catch (error) {
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    handleGetSailingsFeature,
    handleGetSailingDetailsFeature,
    handleStartSailingFeature,
    handleUpdateLegStatusFeature,
    handleCancelHarborArrivalFeature,
    handleChangeBoatFeature,
};
