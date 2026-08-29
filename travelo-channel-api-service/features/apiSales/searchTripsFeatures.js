const { searchTripsHandler } = require("../../handlers/searchTripsHandler");

const handleSearchTripsDataFeature = async (req, res) => {
    try {
        const trips = await searchTripsHandler(req.body, req.partner?.partner_uuid);
        return res.status(200).json({ trips });
    } catch (error) {
        console.log("searchTripsFeature error:", error?.message || error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { handleSearchTripsDataFeature };
