// Oznaka originala i kopije na broju karte.
//
// Svaka izdana karta dobiva tri dodatna znaka (xyz) koji se ispisuju uz broj
// karte i idu u QR. Srednji znak nosi cijelu poruku:
//
//   y === markerZnak(ticket_uuid)  → riječ je o KOPIJI, redni broj je x + z − 6
//   y !== markerZnak(ticket_uuid)  → ORIGINAL, x i z su nasumični i ne znače ništa
//
// markerZnak je 9. heksadecimalni znak uuid-a, crtice se ne broje.
//
// Abeceda sufiksa je heksadecimalna (0-9A-F) namjerno: uuid je hex, pa se y
// uspoređuje izravno sa znakom uuid-a. Da smo uzeli abecedu broja karte s
// mobilne (ALPHA32, bez 0 i 1), karte kojima 9. hex znak ispadne 0 ili 1 ne bi
// se mogle označiti kao kopija — a to je svaka osma.
//
// Sufiks se NE koristi pri validaciji i traženju karte. Broj karte ostaje ono
// što je bio; sufiks stoji u vlastitom stupcu i samo se dopisuje pri ispisu.
const crypto = require("crypto");

const HEX16 = "0123456789ABCDEF";
// Redni broj kopije se kodira kao x + z − 6, gdje su x i z heksadecimalne
// znamenke (0-F, vrijednosti 0..15). Zbroj ide 0..30, pa su zapisive kopije
// 1..24; iznad toga nema mjesta u dva znaka.
//
// Kopije do dvanaeste stanu u same brojke, pa se sufiksi izdani prije prosirenja
// citaju jednako — 9 je i dalje 9, bez obzira citalo se dekadski ili hex.
const POMAK = 6;
const MAX_KOPIJA = 24;

const nasumicni = (abeceda) => abeceda[crypto.randomInt(0, abeceda.length)];

// 9. hex znak uuid-a, bez crtica. Vraća "" ako uuid nije upotrebljiv — tada se
// karta tretira kao original i nikad se ne prijavljuje kao kopija.
const markerZnak = (ticketUuid) => {
    const hex = String(ticketUuid || "").replace(/-/g, "").toUpperCase();
    return hex.length >= 9 ? hex[8] : "";
};

// Sufiks originala: srednji znak mora biti različit od markera, inače bi original
// slučajno ispao kopija — pogodio bi ga jedan od šesnaest.
const suffixOriginala = (ticketUuid) => {
    const marker = markerZnak(ticketUuid);
    const dozvoljeni = marker ? HEX16.split("").filter((c) => c !== marker).join("") : HEX16;
    return nasumicni(HEX16) + nasumicni(dozvoljeni) + nasumicni(HEX16);
};

// Sufiks kopije: srednji znak je marker, a x i z se biraju tako da im zbroj bude
// redni broj kopije uvećan za pomak. Prvi član je nasumičan koliko raspon
// dopušta, da dvije kopije istog rednog broja ne izgledaju identično.
const suffixKopije = (ticketUuid, copyNo) => {
    const marker = markerZnak(ticketUuid);
    if (!marker) return null;
    const n = Number(copyNo);
    if (!Number.isInteger(n) || n < 1 || n > MAX_KOPIJA) return null;
    const zbroj = n + POMAK;
    const donja = Math.max(0, zbroj - 15);
    const gornja = Math.min(15, zbroj);
    const x = crypto.randomInt(donja, gornja + 1);
    return HEX16[x] + marker + HEX16[zbroj - x];
};

// Čitanje sufiksa s papira ili iz QR-a.
//   { isCopy: false }                    — original
//   { isCopy: true, copyNo: n }          — kopija, n je redni broj
//   { isCopy: true, copyNo: null }       — marker se poklapa, ali x i z nisu
//                                          znamenke ili zbroj ispada besmislen
// Nepostojeći ili neispravan sufiks vraća null — starije karte ga nemaju i to
// nije greška.
const procitajSuffix = (ticketUuid, suffix) => {
    const s = String(suffix || "").trim().toUpperCase();
    if (s.length !== 3) return null;
    if (![...s].every((c) => HEX16.includes(c))) return null;
    const marker = markerZnak(ticketUuid);
    if (!marker || s[1] !== marker) return { isCopy: false, copyNo: null };
    const x = HEX16.indexOf(s[0]);
    const z = HEX16.indexOf(s[2]);
    if (x < 0 || z < 0) return { isCopy: true, copyNo: null };
    const n = x + z - POMAK;
    return { isCopy: true, copyNo: n >= 1 && n <= MAX_KOPIJA ? n : null };
};

// Broj karte kakav ide na papir. Bez sufiksa vraća broj kakav je i bio.
const brojZaIspis = (ticketCode, suffix) =>
    suffix ? `${ticketCode || ""} ${suffix}` : String(ticketCode || "");

// QR nosi uuid i još šest polja odvojenih točka-zarezom; sufiks se dopisuje kao
// osmo. Validacija uzima prvo polje, pa je dodatak bezopasan i za stare čitače.
// Ako QR već ima osmo polje, ne dira se — POS zna poslati gotov payload.
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

// Sufiks pročitan iz QR-a; prazno kad ga karta nema.
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
