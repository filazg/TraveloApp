const axios = require("axios");
const { controlServiceURL } = require("../../config/config");

const handleGetModulesConfigFeature = async (req, res) => {
    try {
        const resp = await axios.get(controlServiceURL + "/modules_config", {
            timeout: 6000,
            validateStatus: () => true,
        });
        if (resp.status !== 200) {
            return res.status(resp.status).send({ status: resp.status, data: { message: "modules_config failed" } });
        }
        const payload = resp.data?.data || { modules: [], enabled_modules: [], env_modules: [] };
        return res.send({ status: 200, data: payload });
    } catch (error) {
        console.log("handleGetModulesConfigFeature error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || "modules_config failed" } });
    }
};

module.exports = { handleGetModulesConfigFeature };
