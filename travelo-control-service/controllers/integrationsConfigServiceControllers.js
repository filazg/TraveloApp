const { readConfig } = require("../config/configResolver");

// 7pay kredencijali se ne drže u repou. U integrations_configs.json stoji prazna
// `sevenpay` sekcija, a stvarne vrijednosti se na poslužitelju postavljaju kroz
// env — tako `git pull` ne gazi tajne i one ne završe u povijesti commitova.
const SEVENPAY_ENV = {
    package_name: "SEVENPAY_PACKAGE_NAME",
    api_key: "SEVENPAY_API_KEY",
    email: "SEVENPAY_EMAIL",
    password: "SEVENPAY_PASSWORD",
    partner_id: "SEVENPAY_PARTNER_ID",
    sender_app_id: "SEVENPAY_SENDER_APP_ID",
    version: "SEVENPAY_VERSION",
    ecr_id: "SEVENPAY_ECR_ID",
};

const applySevenPayEnv = (cfg) => {
    const base = { ...(cfg?.sevenpay || {}) };
    let changed = false;
    for (const [key, envName] of Object.entries(SEVENPAY_ENV)) {
        const value = process.env[envName];
        if (value !== undefined && value !== "") {
            base[key] = key === "ecr_id" ? Number(value) : value;
            changed = true;
        }
    }
    if (!changed) return cfg;
    return { ...cfg, sevenpay: base };
};

const getIntegrationsConfigController = async (req, res) => {
    try {
        const cfg = await readConfig("integrations_configs");
        res.send({ status: 200, data: applySevenPayEnv(cfg) });
    } catch (error) {
        console.log("getIntegrationsConfigController error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read integrations config" });
    }
};

module.exports = { getIntegrationsConfigController };
