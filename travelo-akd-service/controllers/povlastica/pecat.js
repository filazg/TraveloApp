const crypto = require("crypto");
const { getIntegrationsConfigData } = require("../configSyncController");

// Zapečaćeni zapis provjere povlastice.
//
// Blagajna dobije nakon provjere niz znakova i ne zna što je u njemu — samo ga
// vrati uz prodaju. Time se postiže ono zbog čega ovo i postoji: kad AKD pošalje
// ključeve i dojava zatraži polja koja danas ne skupljamo, ta polja ulaze ovdje,
// a klijenti se ne diraju.
//
// Pečat je nužan jer isti put koristi i web prodaja, gdje sadržaj prolazi kroz
// preglednik kupca. Bez potpisa bi se postotak popusta dao prepisati.
const TRAJANJE_MS = 60 * 60 * 1000; // provjera vrijedi sat vremena

const tajna = () => {
    const cfg = getIntegrationsConfigData()?.akd?.seop || {};
    // Lozinka web servisa je jedina tajna koju ionako imamo na ovom servisu;
    // kad je nema (mock okolina), pečat i dalje ima smisla protiv slučajnih
    // izmjena, samo ne protiv namjernih.
    return cfg.lozinka || cfg.brodarev_oib || "travelo-povlastica";
};

const uBase64 = (buf) => Buffer.from(buf).toString("base64url");

const potpisi = (tijelo) =>
    uBase64(crypto.createHmac("sha256", tajna()).update(tijelo).digest());

function zapecati(podaci) {
    const tijelo = uBase64(JSON.stringify({ ...podaci, ist: Date.now() + TRAJANJE_MS }));
    return `${tijelo}.${potpisi(tijelo)}`;
}

// Vraća { ok, podaci } ili { ok:false, razlog }. Nikad ne baca — pozivatelj je
// prodaja, a prodaja ne smije pasti zbog neispravnog zapisa; takva karta ide
// dalje kao obična i to se vidi u dojavi.
function otvoriPecat(zapis) {
    const tekst = String(zapis || "");
    const tocka = tekst.lastIndexOf(".");
    if (tocka < 1) return { ok: false, razlog: "zapis nije u očekivanom obliku" };

    const tijelo = tekst.slice(0, tocka);
    const potpis = tekst.slice(tocka + 1);

    const ocekivani = potpisi(tijelo);
    const a = Buffer.from(potpis);
    const b = Buffer.from(ocekivani);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, razlog: "potpis se ne slaže" };
    }

    let podaci;
    try {
        podaci = JSON.parse(Buffer.from(tijelo, "base64url").toString("utf8"));
    } catch (e) {
        return { ok: false, razlog: "zapis se ne da pročitati" };
    }
    if (!podaci?.ist || Date.now() > Number(podaci.ist)) {
        return { ok: false, razlog: "provjera je istekla" };
    }
    return { ok: true, podaci };
}

module.exports = { zapecati, otvoriPecat, TRAJANJE_MS };
