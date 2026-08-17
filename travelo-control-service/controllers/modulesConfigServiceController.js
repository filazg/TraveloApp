const { readConfig } = require("../config/configResolver");

const parseEnabledEnv = () => {
    const raw = process.env.TRAVELO_MODULES || "";
    return raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
};

const computeEnabledModules = (modules, envEnabled) => {
    const envSet = new Set(envEnabled);
    const enabled = new Set();

    for (const m of modules) {
        if (m.always_on === true) enabled.add(m.key);
    }
    for (const m of modules) {
        if (envSet.has(m.key)) enabled.add(m.key);
    }
    // Cascade enable: any module whose `requires` is fully satisfied by an
    // env-enabled parent gets auto-enabled. Lets TRAVELO_MODULES=BOAT pull in
    // BOAT_SALES/DISPATCHER/KAPETAN without having to list them all.
    let added = true;
    while (added) {
        added = false;
        for (const m of modules) {
            if (enabled.has(m.key)) continue;
            const reqs = Array.isArray(m.requires) ? m.requires : [];
            if (reqs.length === 0) continue;
            if (reqs.every((r) => enabled.has(r))) {
                enabled.add(m.key);
                added = true;
            }
        }
    }
    return Array.from(enabled);
};

const getModulesConfigController = async (req, res) => {
    try {
        const cfg = await readConfig("modules_configs");
        const modules = Array.isArray(cfg?.modules) ? cfg.modules : [];
        const envEnabled = parseEnabledEnv();
        const enabled_modules = computeEnabledModules(modules, envEnabled);
        res.send({
            status: 200,
            data: {
                modules,
                enabled_modules,
                env_modules: envEnabled,
            },
        });
    } catch (error) {
        console.log("getModulesConfigController error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read modules config" });
    }
};

module.exports = { getModulesConfigController };
