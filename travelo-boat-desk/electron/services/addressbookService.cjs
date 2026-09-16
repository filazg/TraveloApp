const axios = require("axios");
const https = require("https");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");

// Dohvat centralnog adresara R1 kupaca s poslužitelja. Desk više ne gradi popis
// kupaca iz povijesti vlastitih računa, nego čita zajednički adresar preko
// gatewaya — tako svi terminali vide iste kupce. Bez mreže se ne može dohvatiti;
// blagajnik tada unosi kupca ručno.
async function getAddressbook() {
    const settingsData = await systemSettingsDataModel.findOne();
    const backendUrl = settingsData?.backend_url;
    if (!backendUrl) {
        throw new Error("backend_url nije postavljen u Postavkama sustava.");
    }
    const pairingData = await pairingDataModel.findOne();
    const token = pairingData?.token;

    const response = await axios.get(
        backendUrl + "/terminals/terminal/addressbook",
        {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: { authorization: "Bearer " + token },
            timeout: 15000,
        }
    );

    // Gateway odmata odgovor, pa je niz jednom pod `data`, a jednom na vrhu.
    return response.data?.data ?? response.data ?? [];
}

module.exports = { getAddressbook };
