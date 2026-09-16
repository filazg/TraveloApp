// Sudski registar (Portal otvorenih podataka) API klijent.
// OAuth2 client_credentials -> Bearer token (traje ~6h), pa dohvat subjekta po
// OIB-u. Registar sadrzi SAMO pravne subjekte (tvrtke, obrti) — fizicke osobe
// se ne nalaze, pa lookupByOib za njih vrati { found:false } i ostaje rucni unos.
//
// Kredencijali i URL-ovi dolaze iz integrations configa (control-service), pod
// kljucem "sudreg". environment (test|prod) bira token/api URL.
const axios = require("axios");
const { getIntegrationsConfigData } = require("../configSyncController");

const getCfg = () => {
    const all = getIntegrationsConfigData() || {};
    return all.sudreg || null;
};

// Odabir URL-a prema environmentu; prod je default samo ako je izricito 'prod'.
const urlZa = (cfg, kojiTest, kojiProd) =>
    (cfg.environment === "prod" ? cfg[kojiProd] : cfg[kojiTest]) || "";

// OIB validacija (ISO 7064, MOD 11,10) — filtrira ocite greske prije poziva.
const validanOib = (oib) => {
    const s = String(oib || "").trim();
    if (!/^\d{11}$/.test(s)) return false;
    let ostatak = 10;
    for (let i = 0; i < 10; i++) {
        ostatak = (ostatak + Number(s[i])) % 10;
        if (ostatak === 0) ostatak = 10;
        ostatak = (ostatak * 2) % 11;
    }
    let kontrolna = (11 - ostatak) % 10;
    return kontrolna === Number(s[10]);
};

// Token se cuva u memoriji dok ne istekne (uz sigurnosnu marginu). Kod restarta
// procesa se svakako iznova vadi, pa nema perzistencije.
let tokenCache = { value: null, expiresAt: 0 };

const dohvatiToken = async () => {
    const cfg = getCfg();
    if (!cfg) throw new Error("sudreg: config nije postavljen");
    if (!cfg.client_id || !cfg.client_secret)
        throw new Error("sudreg: client_id/client_secret nisu postavljeni");

    const sada = Date.now();
    if (tokenCache.value && tokenCache.expiresAt > sada + 30000)
        return tokenCache.value;

    const tokenUrl = urlZa(cfg, "token_url_test", "token_url_prod");
    if (!tokenUrl) throw new Error("sudreg: token_url nije postavljen");

    const resp = await axios.post(
        tokenUrl,
        "grant_type=client_credentials",
        {
            auth: { username: cfg.client_id, password: cfg.client_secret },
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 20000,
            validateStatus: () => true,
        },
    );
    if (resp.status >= 400 || !resp.data?.access_token)
        throw new Error(
            `sudreg: token ${resp.status} ${JSON.stringify(resp.data).slice(0, 200)}`,
        );

    const traje = Number(resp.data.expires_in || 3600) * 1000;
    tokenCache = { value: resp.data.access_token, expiresAt: sada + traje };
    return tokenCache.value;
};

// Sudreg detalji_subjekta -> ravna polja kupca koja koriste sve forme.
// Postanski broj se namjerno ne mapira (nije u sjedistu i nije nam potreban).
const uKupca = (j) => {
    const sj = j.sjediste || {};
    const adresa = [sj.ulica, sj.kucni_broj].filter((x) => x || x === 0).join(" ").trim();
    return {
        found: true,
        oib: String(j.oib || ""),
        naziv: j.tvrtka?.ime || j.skracena_tvrtka?.ime || "",
        skraceni_naziv: j.skracena_tvrtka?.ime || "",
        adresa,
        mjesto: sj.naziv_naselja || sj.naziv_opcine || "",
        zupanija: sj.naziv_zupanije || "",
        drzava: "Hrvatska",
        email: j.email_adrese?.[0]?.adresa || "",
        mbs: j.mbs ? String(j.mbs) : "",
    };
};

// Vraca:
//   { found:true, ...polja }        — pravni subjekt pronaden
//   { found:false, reason:'...'} — nije pravni subjekt / nema ga / nevaljan OIB
const lookupByOib = async (oib) => {
    const cfg = getCfg();
    if (!cfg) throw new Error("sudreg: config nije postavljen");
    if (!validanOib(oib)) return { found: false, reason: "invalid_oib" };

    const token = await dohvatiToken();
    const apiUrl = urlZa(cfg, "api_url_test", "api_url_prod");
    if (!apiUrl) throw new Error("sudreg: api_url nije postavljen");

    const resp = await axios.get(`${apiUrl}/detalji_subjekta`, {
        params: {
            expand_relations: true,
            tip_identifikatora: "oib",
            identifikator: String(oib).trim(),
        },
        headers: { Authorization: "Bearer " + token },
        timeout: 20000,
        validateStatus: () => true,
    });

    // 404/prazno ili error_code => nije u registru (npr. fizicka osoba).
    if (resp.status === 404) return { found: false, reason: "not_found" };
    if (resp.status >= 400 || resp.data?.error_code || !resp.data?.oib)
        return { found: false, reason: "not_found" };

    return uKupca(resp.data);
};

module.exports = { lookupByOib, validanOib };
