const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');
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

// Koliko je karata ocitano na svakoj nozi ove voznje. Broji transactions, jer
// on drzi evidenciju ocitanja; bookings.validated nitko ne puni, a i da puni,
// brojao bi samo karte ove voznje — kapetan mora vidjeti i one koje su prosle
// s drugog polaska.
const brojaciValidacija = async (bookings) => {
    try {
        const rute = [...new Set((bookings || []).map((b) => b.route_uuid).filter(Boolean))];
        if (!rute.length) return {};
        const core = await getCoreServiceConfigData();
        const url = core?.services?.transactions?.url;
        if (!url) return {};
        const r = await axios.get(`${url}/validation_counts`, {
            params: { route_uuids: rute.join(',') },
            timeout: 10000,
            validateStatus: () => true,
        });
        return r.data?.data?.counts || {};
    } catch (error) {
        // Brojac je dodatak pregledu, ne uvjet: bez njega kapetan i dalje vidi
        // polazak, samo bez ocitanja.
        console.log('brojaci validacija nisu dohvaceni:', error?.message || error);
        return {};
    }
};

const handleGetSailingDetailsFeature = async (req, res) => {
    try {
        const raw = await getSailingDetailsController(req.params.uuid);
        const payload = raw?.data || { sailing: null, legs: [], bookings: [] };
        payload.validation_counts = await brojaciValidacija(payload.bookings);
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
