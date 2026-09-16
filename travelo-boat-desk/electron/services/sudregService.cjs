const axios = require("axios");
const https = require("https");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");

// Dohvat podataka o pravnoj osobi iz Sudskog registra po OIB-u. Blagajnik ne
// mora prepisivati naziv i adresu s papira — upit ide na poslužitelj koji
// razgovara sa Sudskim registrom, a odgovor popunjava formu novog kupca.
// Bez mreže se ne može napraviti; blagajnik tada podatke unosi ručno.
async function lookupSudreg(oib) {
    const settingsData = await systemSettingsDataModel.findOne();
    const backendUrl = settingsData?.backend_url;
    if (!backendUrl) {
        throw new Error("backend_url nije postavljen u Postavkama sustava.");
    }
    const pairingData = await pairingDataModel.findOne();
    const token = pairingData?.token;

    const response = await axios.get(
        backendUrl + "/terminals/terminal/sudreg",
        {
            params: { oib },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: { authorization: "Bearer " + token },
            timeout: 15000,
        }
    );

    // Gateway odmata odgovor, pa je podatak jednom na vrhu, a jednom pod `data`.
    return response.data?.data ?? response.data;
}

module.exports = { lookupSudreg };
