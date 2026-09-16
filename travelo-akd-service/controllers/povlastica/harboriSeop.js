const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");

// SEOP-otoci luka. Luka u portalu (Brod → Luke) nosi `seop_island` — otok kojem
// pripada; prazno je kopno. Za liniju u modu "prebivaliste" otok s otočne
// iskaznice mora se poklopiti s otokom jedne od luka relacije, pa se ovdje
// dohvaćaju i drže kratko u memoriji (luke se mijenjaju rijetko).
const TRAJANJE_MS = 30000;

let spremljeno = null;
let spremljenoU = 0;

async function dohvatiSveLuke({ svjeze = false } = {}) {
    if (!svjeze && spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;

    const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
    if (!boatUrl) throw new Error("boat servis nije u konfiguraciji");

    const r = await axios.get(`${boatUrl}/harbors`, { timeout: 8000, validateStatus: () => true });
    if (r.status >= 400) throw new Error(`boat /harbors je odgovorio statusom ${r.status}`);
    const luke = r.data?.data?.harbors || r.data?.harbors || [];

    spremljeno = Array.isArray(luke) ? luke : [];
    spremljenoU = Date.now();
    return spremljeno;
}

// SEOP-otoci luka relacije (polazna + dolazna), bez praznih (kopno). Vraća i
// `ok:false` kad se luke ne mogu dohvatiti — pozivatelj tada ne smije tiho
// propustiti provjeru, nego se ponaša kao da otok nije potvrđen.
async function seopOtociRute({ departure_harbor_code, arrival_harbor_code } = {}) {
    let luke = [];
    try {
        luke = await dohvatiSveLuke();
    } catch (e) {
        return { ok: false, otoci: [], greska: e.message };
    }
    const kodovi = [departure_harbor_code, arrival_harbor_code].map((c) => String(c || "").trim());
    const otoci = luke
        .filter((l) => kodovi.includes(String(l.code || "").trim()))
        .map((l) => String(l.seop_island || "").trim())
        .filter(Boolean);
    return { ok: true, otoci: [...new Set(otoci)] };
}

const zaboraviLuke = () => { spremljeno = null; spremljenoU = 0; };

module.exports = { seopOtociRute, zaboraviLuke };
