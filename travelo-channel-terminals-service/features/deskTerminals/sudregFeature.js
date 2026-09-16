const { getSudregLookupController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers");

// GET — provjera OIB-a u Sudskom registru. Desk i mobilna zovu ovo pri unosu
// kupca (pravna osoba) da automatski popune naziv/adresu. Query: oib=<OIB>.
// Proxy prema backoffice GET /sudreg?oib=<OIB>; klijentu vraćamo direktno
// result ({ found, ... }) raspakiran iz sudregData.data.result.
const handleSudregLookupFeature = async (req, res) => {
    try {
        const oib = req.query.oib;
        const sudregData = await getSudregLookupController(oib);
        res.send({ status: 200, data: sudregData.data.result });
    } catch (error) {
        console.log("handleSudregLookupFeature error:", error?.message || error);
        res.send({ status: 502, data: { error: error.message } });
    }
};

module.exports = { handleSudregLookupFeature };
