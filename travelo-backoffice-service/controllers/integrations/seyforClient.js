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

// --- Sifarnici analitike (citanje) ---------------------------------------
//
// Mjesta troska, nositelji i referenti zive u iCenteru; kod nas se samo biraju.
// Ne prepisuju se u nasu bazu: popisi su mali (7-27 kB) i stizu za pola
// sekunde, pa bi vlastita kopija donijela samo jos jedan izvor istine koji zna
// zastarjeti. Drze se kratko u memoriji, da otvaranje forme ne znaci poziv za
// svaki pritisak tipke.
const MEMORIJA_MS = 10 * 60 * 1000;
const spremnik = new Map();

const uNiz = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Svaki sifarnik ima svoje nazive polja, ali nama trebaju iste tri stvari:
// sifra, opis i je li aktivan.
const SIFARNICI = {
    cost_centers: {
        put: "/api/costcenters",
        korijen: "ArrayOfCostCenter",
        stavka: "CostCenter",
        sifra: "CostCenterId",
        opis: "CostCenterDescription",
    },
    cost_units: {
        put: "/api/costunits",
        korijen: "ArrayOfCostUnit",
        stavka: "CostUnit",
        sifra: "CostUnitId",
        opis: "CostUnitDescription",
    },
    clerks: {
        put: "/api/clerks",
        korijen: "ArrayOfClerk",
        stavka: "Clerk",
        sifra: "ClerkId",
        opis: "ClerkDescription",
    },
};

const dohvatiSifarnik = async (vrsta, { svjeze = false } = {}) => {
    const def = SIFARNICI[vrsta];
    if (!def) throw new Error(`nepoznat sifarnik: ${vrsta}`);

    const zapamceno = spremnik.get(vrsta);
    if (!svjeze && zapamceno && Date.now() - zapamceno.kad < MEMORIJA_MS) {
        return { ...zapamceno.podaci, iz_memorije: true };
    }

    const parsed = await callApi("get", def.put);
    const stavke = uNiz(parsed?.[def.korijen]?.[def.stavka]).map((r) => ({
        code: String(r?.[def.sifra] ?? "").trim(),
        name: String(r?.[def.opis] ?? "").trim(),
        // `Active` je "true"/"false" kao tekst; sve osim izricitog "false" se
        // racuna aktivnim, da nova stavka bez tog polja ne ispadne iz popisa.
        is_active: String(r?.Active ?? "true").toLowerCase() !== "false",
    })).filter((r) => r.code);

    const podaci = { kind: vrsta, items: stavke, fetched_at: new Date().toISOString() };
    spremnik.set(vrsta, { kad: Date.now(), podaci });
    return { ...podaci, iz_memorije: false };
};

module.exports = {
    dohvatiSifarnik,
    VRSTE_SIFARNIKA: Object.keys(SIFARNICI),
    addCustomer,
    updateCustomer,
    findCustomerByOib,
    callApi,
};
