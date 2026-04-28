const { readConfig } = require("../config/configResolver");

const getMainServicesConfig = async (req, res) => {
    try {
        const config = await readConfig("services_configs");
        res.send({ status: 200, data: { services: config.main_services } });
    } catch (error) {
        console.log("getMainServicesConfig error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read services config" });
    }
};
const getChannelServicesConfig = async (req, res) => {
    try {
        const config = await readConfig("services_configs");
        res.send({ status: 200, data: { services: config.channel_services } });
    } catch (error) {
        console.log("getChannelServicesConfig error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read services config" });
    }
};
const getCoreServicesConfig = async (req, res) => {
    try {
        const config = await readConfig("services_configs");
        res.send({ status: 200, data: { services: config.core_services } });
    } catch (error) {
        console.log("getCoreServicesConfig error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read services config" });
    }
};

module.exports = { getMainServicesConfig, getChannelServicesConfig, getCoreServicesConfig };
