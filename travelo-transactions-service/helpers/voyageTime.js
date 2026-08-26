// Rad s vremenima polazaka.
//
// Vremena se u bazi drže kao tekst "DD.MM.YYYY. HH:mm" (npr. "06.09.2026. 08:00").
// `new Date()` taj oblik ne parsira — vrati Invalid Date — pa se sve računa
// ovdje, preko minuta od epohe, i vraća natrag u isti tekstualni oblik.

const dvoznamenkasto = (n) => String(n).padStart(2, "0");

// "DD.MM.YYYY. HH:mm" -> broj minuta (UTC, da ljetno/zimsko računanje vremena
// ne pomakne rezultat). Vraća null ako oblik ne odgovara.
const uMinute = (tekst) => {
    const m = String(tekst || "").match(/^(\d{2})\.(\d{2})\.(\d{4})\.?\s*(\d{2}):(\d{2})$/);
    if (!m) return null;
    const [, dan, mjesec, godina, sat, minuta] = m;
    return Math.floor(Date.UTC(+godina, +mjesec - 1, +dan, +sat, +minuta) / 60000);
};

// Broj minuta -> "DD.MM.YYYY. HH:mm"
const izMinuta = (minute) => {
    const d = new Date(minute * 60000);
    return `${dvoznamenkasto(d.getUTCDate())}.${dvoznamenkasto(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}. `
        + `${dvoznamenkasto(d.getUTCHours())}:${dvoznamenkasto(d.getUTCMinutes())}`;
};

// Pomakni vrijeme za zadani broj minuta. Neispravan ili prazan ulaz vraća se
// nepromijenjen — bolje ostaviti staru vrijednost nego upisati smeće.
const pomakni = (tekst, deltaMinuta) => {
    const m = uMinute(tekst);
    if (m === null) return tekst;
    return izMinuta(m + deltaMinuta);
};

module.exports = { uMinute, izMinuta, pomakni };
