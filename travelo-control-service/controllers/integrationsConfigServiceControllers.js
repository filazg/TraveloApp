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
    merchant_tax_id: "SEVENPAY_MERCHANT_TAX_ID",
    version: "SEVENPAY_VERSION",
    ecr_id: "SEVENPAY_ECR_ID",
};

// SAOP (Seyfor iCenter) — isti razlog kao kod 7pay: lozinka integracijskog
// korisnika ne pripada repou. Ostatak (URL, korisnik, organizacija, knjiga)
// nije tajna i stoji u configu, da se ne mora postavljati na svakom stroju.
const SEYFOR_ENV = {
    base_url: "SEYFOR_BASE_URL",
    username: "SEYFOR_USERNAME",
    password: "SEYFOR_PASSWORD",
    organisation_id: "SEYFOR_ORGANISATION_ID",
    link_to_book: "SEYFOR_LINK_TO_BOOK",
};

const applySeyforEnv = (cfg) => primijeniEnv(cfg, "seyfor", SEYFOR_ENV);
const applyYescorEnv = (cfg) => primijeniEnv(cfg, "yescor", YESCOR_ENV);
const applySudregEnv = (cfg) => primijeniEnv(cfg, "sudreg", SUDREG_ENV);

// YesCor (F2 e-racun) i Sudski registar — isti razlog: kljucevi i tajne ne
// pripadaju repou, a URL-ovi i okolina nisu tajna pa smiju ostati u configu.
// Bez ovoga se datoteka uredivala po posluzitelju i svaki `git pull` koji ju je
// dirao zavrsio je sudarom.
const YESCOR_ENV = {
    environment: "YESCOR_ENVIRONMENT",
    token_url: "YESCOR_TOKEN_URL",
    api_url: "YESCOR_API_URL",
    client_id: "YESCOR_CLIENT_ID",
    client_secret: "YESCOR_CLIENT_SECRET",
    app_secret: "YESCOR_APP_SECRET",
};

const SUDREG_ENV = {
    environment: "SUDREG_ENVIRONMENT",
    token_url_test: "SUDREG_TOKEN_URL_TEST",
    api_url_test: "SUDREG_API_URL_TEST",
    token_url_prod: "SUDREG_TOKEN_URL_PROD",
    api_url_prod: "SUDREG_API_URL_PROD",
    client_id: "SUDREG_CLIENT_ID",
    client_secret: "SUDREG_CLIENT_SECRET",
};

// Prepisuje polja sekcije vrijednostima iz okoline. Prazna varijabla se
// namjerno ne racuna: brisanje vrijednosti mora biti izmjena configa, a ne
// posljedica varijable koja je slucajno ostala prazna.
const primijeniEnv = (cfg, sekcija, mapa, pretvori = (k, v) => v) => {
    const base = { ...(cfg?.[sekcija] || {}) };
    let changed = false;
    for (const [key, envName] of Object.entries(mapa)) {
        const value = process.env[envName];
        if (value !== undefined && value !== "") {
            base[key] = pretvori(key, value);
            changed = true;
        }
    }
    if (!changed) return cfg;
    return { ...cfg, [sekcija]: base };
};

const applySevenPayEnv = (cfg) =>
    primijeniEnv(cfg, "sevenpay", SEVENPAY_ENV, (key, value) => (key === "ecr_id" ? Number(value) : value));

const getIntegrationsConfigController = async (req, res) => {
    try {
        const cfg = await readConfig("integrations_configs");
        const sOkolinom = [applySevenPayEnv, applySeyforEnv, applyYescorEnv, applySudregEnv]
            .reduce((k, primijeni) => primijeni(k), cfg);
        res.send({ status: 200, data: sOkolinom });
    } catch (error) {
        console.log("getIntegrationsConfigController error:", error?.message || error);
        res.status(500).send({ status: 500, error: "failed to read integrations config" });
    }
};

module.exports = { getIntegrationsConfigController };
