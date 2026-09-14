const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");

// Pravila povlastica po liniji. Ured ih uređuje u portalu (Brod → Linije), a
// odluka se donosi ovdje, na poslužitelju — blagajna ih ne smije tumačiti sama.
// Kad se pravilo promijeni, promjena vrijedi odmah i bez novog builda POS-a.
//
// Drži se kratko u memoriji: pri prodaji se pita za svaku provjeru, a linije se
// mijenjaju rijetko.
const TRAJANJE_MS = 30000;

let spremljeno = null;
let spremljenoU = 0;

const ZADANO = {
    seop_mode: "ne",
    mosi_accepted: false,
    mosi_discount_pct: 0,
    mosi_companion_free: false,
};

async function dohvatiSveLinije({ svjeze = false } = {}) {
    if (!svjeze && spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;

    const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
    if (!boatUrl) throw new Error("boat servis nije u konfiguraciji");

    const r = await axios.get(`${boatUrl}/lines`, { timeout: 8000, validateStatus: () => true });
    if (r.status >= 400) throw new Error(`boat /lines je odgovorio statusom ${r.status}`);
    const linije = r.data?.data?.lines || r.data?.lines || [];

    spremljeno = linije;
    spremljenoU = Date.now();
    return linije;
}

// Linija se traži po šifri (brLinije iz plovidbenog reda). Kad je nema, vraćaju
// se zadane vrijednosti — a zadano je „ne prihvaća", jer povlasticu treba
// svjesno uključiti, ne propustiti je slučajno.
async function pravilaZaLiniju(sifraLinije) {
    const trazena = String(sifraLinije || "").trim();
    if (!trazena) return { ...ZADANO, nadena: false };

    let linije = [];
    try {
        linije = await dohvatiSveLinije();
    } catch (e) {
        // Bez pravila se ne smije prodavati povlašteno, ali ni pasti prodaja —
        // pozivatelj iz ovoga vidi da odluka nije donesena.
        return { ...ZADANO, nadena: false, greska: e.message };
    }

    const linija = linije.find((l) => String(l.code || "").trim() === trazena);
    if (!linija) return { ...ZADANO, nadena: false };

    return {
        nadena: true,
        line_uuid: linija.uuid || null,
        line_name: linija.name || null,
        seop_mode: linija.seop_mode || "ne",
        mosi_accepted: linija.mosi_accepted === true,
        mosi_discount_pct: Number.isFinite(Number(linija.mosi_discount_pct)) ? Number(linija.mosi_discount_pct) : 0,
        mosi_companion_free: linija.mosi_companion_free === true,
    };
}

const zaboraviPravila = () => { spremljeno = null; spremljenoU = 0; };

module.exports = { pravilaZaLiniju, zaboraviPravila };
