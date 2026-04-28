const { readConfig } = require("../config/configResolver");

const getIntegrationsConfigController = async (req, res) => {
    try {
        const cfg = await readConfig("integrations_configs");
        res.send({ status: 200, data: cfg });
    } catch (error) {
        console.log("getIntegrationsConfigController error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read integrations config" });
    }
};

module.exports = { getIntegrationsConfigController };
