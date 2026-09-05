// Oznaka originala i kopije na broju karte — inačica za blagajnu.
//
// Ista pravila kao travelo-transactions-service/helpers/ticketCopyMark.js i
// travelo-mobile/src/store/ticketCopyMark.js. Duplicira se jer blagajna ne
// povlači kod iz servisa; mijenja li se pravilo, mijenja se na sva tri mjesta.
//
//   y === markerZnak(ticket_uuid)  → KOPIJA, redni broj je x + z − 6
//   y !== markerZnak(ticket_uuid)  → ORIGINAL, x i z ne znače ništa
//
// markerZnak je 9. heksadecimalni znak uuid-a, crtice se ne broje. Abeceda
// sufiksa je hex (0-9A-F) da se y može izravno usporediti sa znakom uuid-a.
const crypto = require("crypto");

const HEX16 = "0123456789ABCDEF";
const POMAK = 6;
const MAX_KOPIJA = 12;

const nasumicni = (abeceda) => abeceda[crypto.randomInt(0, abeceda.length)];

const markerZnak = (ticketUuid) => {
    const hex = String(ticketUuid || "").replace(/-/g, "").toUpperCase();
    return hex.length >= 9 ? hex[8] : "";
};

// Srednji znak mora biti različit od markera, inače bi original slučajno ispao
// kopija — pogodio bi ga jedan od šesnaest.
const suffixOriginala = (ticketUuid) => {
    const marker = markerZnak(ticketUuid);
    const dozvoljeni = marker ? HEX16.split("").filter((c) => c !== marker).join("") : HEX16;
    return nasumicni(HEX16) + nasumicni(dozvoljeni) + nasumicni(HEX16);
};

const suffixKopije = (ticketUuid, copyNo) => {
    const marker = markerZnak(ticketUuid);
    if (!marker) return null;
    const n = Number(copyNo);
    if (!Number.isInteger(n) || n < 1 || n > MAX_KOPIJA) return null;
    const zbroj = n + POMAK;
    const donja = Math.max(0, zbroj - 9);
    const gornja = Math.min(9, zbroj);
    const x = crypto.randomInt(donja, gornja + 1);
    return String(x) + marker + String(zbroj - x);
};

const procitajSuffix = (ticketUuid, suffix) => {
    const s = String(suffix || "").trim().toUpperCase();
    if (s.length !== 3) return null;
    if (![...s].every((c) => HEX16.includes(c))) return null;
    const marker = markerZnak(ticketUuid);
    if (!marker || s[1] !== marker) return { isCopy: false, copyNo: null };
    const x = Number(s[0]);
    const z = Number(s[2]);
    if (!Number.isInteger(x) || !Number.isInteger(z)) return { isCopy: true, copyNo: null };
    const n = x + z - POMAK;
    return { isCopy: true, copyNo: n >= 1 && n <= MAX_KOPIJA ? n : null };
};

const brojZaIspis = (ticketCode, suffix) =>
    suffix ? `${ticketCode || ""} ${suffix}` : String(ticketCode || "");

// QR nosi uuid i još šest polja odvojenih točka-zarezom; sufiks je osmo.
// Validacija uzima prvo polje, pa je dodatak bezopasan i za starije čitače.
const QR_POLJA_BEZ_SUFIKSA = 7;

const qrSaSuffixom = (ticketQr, suffix) => {
    const qr = String(ticketQr || "");
    if (!suffix) return qr;
    const polja = qr.split(";");
    if (polja.length > QR_POLJA_BEZ_SUFIKSA) return qr;
    while (polja.length < QR_POLJA_BEZ_SUFIKSA) polja.push("");
    polja.push(suffix);
    return polja.join(";");
};

const suffixIzQr = (ticketQr) => {
    const polja = String(ticketQr || "").split(";");
    return polja.length > QR_POLJA_BEZ_SUFIKSA ? polja[QR_POLJA_BEZ_SUFIKSA] : "";
};

module.exports = {
    HEX16,
    MAX_KOPIJA,
    markerZnak,
    suffixOriginala,
    suffixKopije,
    procitajSuffix,
    brojZaIspis,
    qrSaSuffixom,
    suffixIzQr,
};
