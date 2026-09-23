// SAOP (Seyfor iCenter) — slanje temeljnica iz dnevne realizacije.
//
// Kupci idu kroz backoffice (`travelo-backoffice-service/controllers/
// integrations/seyforClient.js`, uz adresar); ovdje je samo knjiženje, jer se
// temeljnica slaže u ovom servisu, iz računa. Isti obrazac kao yescorClient
// pokraj: konfiguracija iz control-servisa, klijent ne zna ništa o poslu.
//
// Kredencijali (`seyfor.username` / `seyfor.password`) stoje u integrations
// configu i nikad u kodu — stari prototip (`old/reports_service/controllers/
// erp_integrations/dailyReportsControllers.js`) imao ih je upisane u izvor.

const axios = require("axios");
const https = require("https");
const xml2js = require("xml2js");
const { getIntegrationsConfigData } = require("../configSyncController");

// iCenter na testu ima certifikat kojem lanac ne vodi do javnog korijena; isto
// kao u backofficeu, veza se ne odbija zbog toga.
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const xmlBuilder = new xml2js.Builder({ headless: false });

const getCfg = () => {
    const all = getIntegrationsConfigData() || {};
    return all.seyfor || null;
};

const buildHeaders = (cfg) => ({
    Authorization: "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64"),
    OrganisationId: String(cfg.organisation_id || "2"),
    Accept: "application/xml",
    "Content-Type": "application/xml",
});

// Odgovor iCentera je XML, a poruka o gresci zna doci i u zaglavlju
// `x-icenter-message` — bez nje se iz samog statusa ne vidi sto je odbijeno.
//
// Odbijenica dolazi kao <ArrayOfError><Error><Level/><Message/></Error>…, pa se
// vade same recenice: knjigovodi treba "Na stavci nedostaje mjesto troska…", a
// ne cijela omotnica s namespaceovima. Sirovi odgovor ide dalje zasebno, za
// slucaj da treba pogledati sto je tocno stiglo.
const izvadiPoruke = (tekst) => {
    if (typeof tekst !== "string") return [];
    return [...tekst.matchAll(/<Message>([\s\S]*?)<\/Message>/g)]
        .map((m) => m[1].trim())
        .filter(Boolean);
};

const poruka = (resp) => {
    const zaglavlje = resp?.headers?.["x-icenter-message"] || "";
    const izXmla = izvadiPoruke(resp?.data);
    if (izXmla.length) return [zaglavlje, ...izXmla].filter(Boolean).join(" ");
    const tijelo = typeof resp?.data === "string" ? resp.data.slice(0, 500) : "";
    return [zaglavlje, tijelo].filter(Boolean).join(" | ");
};

// Salje jednu temeljnicu. `nalog` je vec slozen objekt oblika
// { Accounting: { AccountingHeader, JournalEntries } } — gradi ga
// seyforJournalBuilder, da klijent ostane bez znanja o kontima.
const addJournal = async (nalog) => {
    const cfg = getCfg();
    if (!cfg?.base_url) throw new Error("seyfor: base_url nije konfiguriran");
    if (!cfg?.username || !cfg?.password) throw new Error("seyfor: username/password nisu konfigurirani");

    const xml = xmlBuilder.buildObject(nalog);
    const url = cfg.base_url.replace(/\/$/, "") + "/api/journals/AddJournal";
    const resp = await axios({
        method: "POST",
        url,
        headers: buildHeaders(cfg),
        data: xml,
        httpsAgent,
        timeout: 30000,
        validateStatus: () => true,
    });

    if (resp.status >= 400) {
        const greska = new Error(`SAOP je odbio temeljnicu (${resp.status}): ${poruka(resp)}`);
        greska.status = resp.status;
        greska.raw = typeof resp.data === "string" ? resp.data.slice(0, 2000) : resp.data;
        greska.xml = xml;
        throw greska;
    }
    return {
        status: resp.status,
        message: poruka(resp) || "Temeljnica je zaprimljena.",
        // Sirovi odgovor ide dalje nepromijenjen: ne tumaci se ovdje, a u
        // portalu se prikazuje kako je stigao.
        raw: typeof resp.data === "string" ? resp.data.slice(0, 2000) : resp.data,
        xml,
    };
};

module.exports = { addJournal };
