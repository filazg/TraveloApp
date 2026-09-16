const { getAddressbookController, upsertAddressbookController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers");

// GET — centralni adresar kupaca. Desk i mobilna ga koriste za dohvat/pretragu
// spremljenih kupaca. Proxy prema backoffice GET /addressbook; klijentu vraćamo
// direktno NIZ kupaca u `data` (raspakiran iz resp.data.addressbook).
const handleGetAddressbookFeature = async (req, res) => {
    try {
        const resp = await getAddressbookController();
        res.send({ status: 200, data: (resp?.data?.addressbook || []) });
    } catch (error) {
        console.log("handleGetAddressbookFeature error:", error?.message || error);
        res.send({ status: 502, data: { error: error.message } });
    }
};

// POST — upis/ažuriranje kupca u adresaru. Prosljeđuje cijeli req.body
// (oblik { body: {...} }) na backoffice POST /addressbook/upsert. Idempotentno
// po OIB-u; vraća { uuid, created }.
const handleUpsertAddressbookFeature = async (req, res) => {
    try {
        const resp = await upsertAddressbookController(req.body);
        res.send({ status: 200, data: resp?.data || null });
    } catch (error) {
        console.log("handleUpsertAddressbookFeature error:", error?.message || error);
        res.send({ status: 502, data: { error: error.message } });
    }
};

module.exports = { handleGetAddressbookFeature, handleUpsertAddressbookFeature };
