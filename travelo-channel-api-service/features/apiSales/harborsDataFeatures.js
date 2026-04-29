const { getHarborsController } = require("../../controllers/coreServiceControllers/salesServiceControllers");

const handleGetHarborsDataFeature = async (req, res) => {
    try {
        const harborsData = await getHarborsController();
        const harbors = (harborsData?.data?.harbors || []).map((h) => ({
            harbor_name: h.name,
            harbor_code: h.code,
            harbor_longitude: h.longitude,
            harbor_latitude: h.latitude,
            harbor_region: h.region,
            harbor_country: h.country,
        }));
        return res.status(200).json({ harbors });
    } catch (error) {
        console.log("harborsDataFeature error:", error?.message || error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { handleGetHarborsDataFeature };
