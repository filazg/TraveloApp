const { apiGetTripDetails } = require("../../controllers/coreServiceControllers/transactionsServiceControllers");

const handleTripDetailsFeature = async (req, res) => {
    try {
        const { trip_uuid } = req.body || {};
        if (!trip_uuid) {
            return res.status(400).json({ msg: "trip_uuid required" });
        }
        const result = await apiGetTripDetails({ trip_uuid });
        if (!result || result.status !== 200) {
            return res.status(result?.status || 500).json(result?.data || { msg: "Could not get trip details" });
        }
        return res.status(200).json({ trip_details: result.data.trip_details || [] });
    } catch (error) {
        console.log("tripDetailsFeature error:", error?.message || error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { handleTripDetailsFeature };
