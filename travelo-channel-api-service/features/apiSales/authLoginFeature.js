const { apiPartnerLogin } = require("../../controllers/coreServiceControllers/authServiceControllers");

const handleApiSalesLoginFeature = async (req, res) => {
    try {
        const { tid, otp } = req.body || {};
        if (!tid || !otp) {
            return res.status(400).json({ msg: "tid/otp required" });
        }
        const response = await apiPartnerLogin({ tid, otp });
        return res.status(response.status).json(response.data);
    } catch (error) {
        const status = error?.response?.status || 500;
        const data = error?.response?.data || { msg: "Internal error" };
        return res.status(status).json(data);
    }
};

module.exports = { handleApiSalesLoginFeature };
