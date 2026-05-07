// Seyfor (SAOP iCenter) API klijent — koristi se za sync adresara s SAOP-om.
// Ne ulazi u SOAP - REST/XML preko HTTPS na seyfor.krilo.hr:8383/iCenterApi.
// Auth: Basic, OrganisationId header, opcionalno self-signed cert.
const axios = require("axios");
const https = require("https");
const xml2js = require("xml2js");
const { getIntegrationsConfigData } = require("../configSyncController");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const xmlBuilder = new xml2js.Builder({ headless: false });

const getCfg = () => {
    const all = getIntegrationsConfigData() || {};
    return all.seyfor || null;
};

const buildHeaders = (cfg, extra = {}) => {
    const auth =
        "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
    return {
        Authorization: auth,
        OrganisationId: String(cfg.organisation_id || "2"),
        Accept: "application/xml",
        "Content-Type": "application/xml",
        ...extra,
    };
};

const callApi = async (method, path, body = null) => {
    const cfg = getCfg();
    if (!cfg?.base_url) throw new Error("seyfor: base_url not configured");
    if (!cfg?.username || !cfg?.password)
        throw new Error("seyfor: username/password not configured");
    const url = cfg.base_url.replace(/\/$/, "") + path;
    const resp = await axios({
        method,
        url,
        headers: buildHeaders(cfg),
        data: body || undefined,
        httpsAgent,
        timeout: 30000,
        validateStatus: () => true,
    });
    if (resp.status >= 400) {
        const msg = resp.headers?.["x-icenter-message"] || "";
        throw new Error(
            `seyfor ${method} ${path} → ${resp.status} ${msg} ${typeof resp.data === "string" ? resp.data.slice(0, 300) : ""}`,
        );
    }
    if (typeof resp.data === "string" && resp.data.trim().startsWith("<")) {
        return xml2js.parseStringPromise(resp.data, {
            explicitArray: false,
            ignoreAttrs: true,
        });
    }
    return resp.data;
};

// addressbook → SAOP Customer mapping. Code se ne šalje pri create-u —
// SuggestFirstFreeCode=1 daje SAOP-u naredbu da dodijeli prvi slobodan.
const buildCustomerXml = (addr, { withCode = false } = {}) => {
    const isCompany = !!(addr.buyer_company_name && addr.buyer_company_name.trim());
    const name = isCompany ? addr.buyer_company_name : addr.buyer_name || "";
    const subjectToVat = addr.buyer_vat_id ? "1" : "0";
    const root = {
        Customer: {
            ...(withCode && addr.saop_customer_code
                ? { Code: addr.saop_customer_code }
                : {}),
            Name: name,
            ...(addr.buyer_address ? { Address: addr.buyer_address } : {}),
            ...(addr.buyer_country ? { Country: addr.buyer_country } : {}),
            ...(addr.buyer_postal_code ? { PostalCode: addr.buyer_postal_code } : {}),
            ...(addr.buyer_town ? { City: addr.buyer_town } : {}),
            ...(addr.buyer_legal_id ? { RegistrationNumber: addr.buyer_legal_id } : {}),
            SubjectToVAT: subjectToVat,
            ...(addr.buyer_vat_id ? { TaxNumber: addr.buyer_vat_id } : {}),
            Currency: "978",
            CustomerType: "O",
            EntityType: isCompany ? "P" : "F",
            ...(withCode ? {} : { SuggestFirstFreeCode: 1 }),
        },
    };
    return xmlBuilder.buildObject(root);
};

const extractCodeFromCreateResult = (parsed) => {
    // Response shape: <CreateResult><Keys><EntityKeyField><Value>0001573</Value>...
    const cr = parsed?.CreateResult || parsed;
    const keys = cr?.Keys?.EntityKeyField;
    const list = Array.isArray(keys) ? keys : keys ? [keys] : [];
    for (const k of list) {
        if (k?.Name === "Code" || k?.Value) return k.Value;
    }
    return null;
};

const addCustomer = async (addressbookEntry) => {
    const xml = buildCustomerXml(addressbookEntry, { withCode: false });
    const parsed = await callApi("post", "/api/Customers/AddCustomer", xml);
    const code = extractCodeFromCreateResult(parsed);
    return { code, raw: parsed };
};

const updateCustomer = async (addressbookEntry) => {
    if (!addressbookEntry.saop_customer_code)
        throw new Error("updateCustomer: saop_customer_code missing");
    const xml = buildCustomerXml(addressbookEntry, { withCode: true });
    const parsed = await callApi("patch", "/api/V2/Customers/UpdateCustomer", xml);
    return { raw: parsed };
};

const findCustomerByOib = async (oib) => {
    if (!oib) return null;
    const parsed = await callApi(
        "get",
        `/api/Customers/GetCustomers?TaxNumber=${encodeURIComponent(oib)}`,
    );
    const arr = parsed?.ArrayOfCustomer?.Customer;
    const list = Array.isArray(arr) ? arr : arr ? [arr] : [];
    return list[0] || null;
};

module.exports = {
    addCustomer,
    updateCustomer,
    findCustomerByOib,
    callApi,
};
