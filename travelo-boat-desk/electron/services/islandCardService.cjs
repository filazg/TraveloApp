const axios = require("axios");
const https = require("https");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");

// Provjera otočnog prava upisom broja iskaznice ili OIB-a.
//
// Čip se ne da uvijek pročitati — istrošena kartica, čitač koji ne reagira,
// putnik koji je iskaznicu zaboravio. Specifikacija SEOP-a zato traži da
// blagajna omogući isti upit i upisom podataka. Provjera ide na poslužitelj i
// bez mreže se ne može napraviti; blagajnik tada prodaje redovnu kartu.
async function checkIslandCardService(data) {
    const settingsData = await systemSettingsDataModel.findOne();
    const backendUrl = settingsData?.backend_url;
    if (!backendUrl) {
        throw new Error("backend_url nije postavljen u Postavkama sustava.");
    }
    const pairingData = await pairingDataModel.findOne();
    const token = pairingData?.token;

    const response = await axios.post(
        backendUrl + "/terminals/terminal/check_island_card",
        {
            card_no: data?.card_no || null,
            oib: data?.oib || null,
            uid: data?.uid || null,
            iks: data?.iks || null,
            route: data?.route || {},
            date: data?.date || new Date().toISOString(),
        },
        {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: { authorization: "Bearer " + token },
            timeout: 15000,
            validateStatus: () => true,
        }
    );

    // Gateway odmata odgovor, pa je podatak jednom na vrhu, a jednom pod `data`.
    const tijelo = response.data?.data ?? response.data ?? {};
    if (response.status >= 400) {
        return { ok: false, poruka: tijelo.message || `Poslužitelj je odgovorio statusom ${response.status}.` };
    }
    return { ok: true, ...tijelo };
}

module.exports = { checkIslandCardService };
