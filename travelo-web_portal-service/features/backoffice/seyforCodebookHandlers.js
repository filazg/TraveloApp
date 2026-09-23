const axios = require("axios");
const { getCoreServiceConfigData } = require("../../controllers/configServices/configSyncController");

// Prolaz prema backofficeu, koji jedini razgovara sa SAOP-om. Portal time ne
// zna ni za iCenter ni za njegove kredencijale — vidi samo popis sifri.
const handleGetSeyforCodebookFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boUrl = core?.services?.backoffice?.url;
        if (!boUrl) throw new Error("backoffice servis nije u konfiguraciji");

        const r = await axios.get(`${boUrl}/seyfor_codebook`, {
            params: { kind: req.query.kind, refresh: req.query.refresh },
            timeout: 30000,
            validateStatus: () => true,
        });
        return res.status(r.status).send(r.data);
    } catch (error) {
        console.log("handleGetSeyforCodebookFeature error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { handleGetSeyforCodebookFeature };
