const { readConfig } = require("../config/configResolver");

// Lozinka više ne živi u repo-u. JSON config ima db_pass:"" — runtime injektira
// vrijednost iz process.env.DB_PASS (postavlja se u pm2 ecosystemu ili .env-u
// na samoj VM). Ako env nije postavljen, vraćamo prazan string i klijenti
// padaju na DB connection — to je signal da je env zaboravljen.
//
// Profile support: consumer može poslati { service, profile } u body. `_profiles`
// blok u config fileu definira `db_name_prefix` koji se prependa na db_name.
// Bez profila ili s "default" profilom — ponašanje 100% backward kompatibilno.
const getDatabaseConfigController = async (req, res) => {
    try {
        const data = req.body || {};
        const config = await readConfig("databases_configs");
        const entry = config[data.service];
        if (!entry) {
            return res.send(undefined);
        }
        const out = { ...entry };

        const requested = (data.profile || process.env.TRAVELO_PROFILE || "default").trim();
        const profiles = config._profiles || {};
        const profile = profiles[requested] || profiles.default || {};
        const prefix = profile.db_name_prefix || "";
        if (prefix && out.db_name) {
            out.db_name = `${prefix}${out.db_name}`;
        }
        out.profile = requested;

        if (!out.db_pass && process.env.DB_PASS) {
            out.db_pass = process.env.DB_PASS;
        }
        res.send(out);
    } catch (error) {
        console.log("getDatabaseConfigController error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read databases config" });
    }
};

module.exports = { getDatabaseConfigController };
