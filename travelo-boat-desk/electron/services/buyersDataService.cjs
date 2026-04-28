const axios = require("axios");
const https = require("https");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");

// Vraća listu prethodnih kupaca s OIB-om iz backenda — desk-ov "adresar".
const getBuyersDataService = async (params = {}) => {
    try {
        const settingsData = await systemSettingsDataModel.findOne();
        const backendUrl = settingsData?.backend_url;
        if (!backendUrl) {
            throw new Error("backend_url nije postavljen u Settings.");
        }
        const pairingData = await pairingDataModel.findOne();
        const token = pairingData?.token;
        const resp = await axios.get(backendUrl + "/terminals/terminal/buyers", {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            params: {
                limit: params.limit || 500,
                ...(params.search ? { search: params.search } : {}),
            },
            headers: { authorization: "Bearer " + token },
            validateStatus: () => true,
        });
        // Gateway već unwrappa pa response.data može biti niz ili objekt s `buyers`.
        if (Array.isArray(resp.data)) return resp.data;
        return resp.data?.buyers || resp.data?.data?.buyers || [];
    } catch (error) {
        console.log("getBuyersDataService error:", error?.response?.data || error?.message || error);
        return [];
    }
};

module.exports = { getBuyersDataService };
