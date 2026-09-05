// Oznaka originala i kopije na broju karte — mobilna inačica.
//
// Ista pravila kao travelo-transactions-service/helpers/ticketCopyMark.js;
// duplicira se jer mobilna ne može povlačiti kod iz servisa. Mijenja li se
// pravilo, mijenja se na oba mjesta.
//
//   y === markerZnak(ticket_uuid)  → KOPIJA, redni broj je x + z − 6
//   y !== markerZnak(ticket_uuid)  → ORIGINAL, x i z ne znače ništa
//
// markerZnak je 9. heksadecimalni znak uuid-a, crtice se ne broje. Abeceda
// sufiksa je hex (0-9A-F) namjerno: uuid je hex, pa se y uspoređuje izravno sa
// znakom uuid-a. Abeceda broja karte (ALPHA32) nema 0 ni 1, pa se s njom svaka
// osma karta ne bi mogla označiti kao kopija.

const HEX16 = '0123456789ABCDEF';
// Redni broj kopije se kodira kao x + z − 6, gdje su x i z heksadecimalne
// znamenke (0-F, vrijednosti 0..15). Zbroj ide 0..30, pa su zapisive kopije
// 1..24. Kopije do dvanaeste stanu u same brojke, pa se sufiksi izdani prije
// proširenja čitaju jednako — 9 je i dalje 9, čitalo se dekadski ili hex.
const POMAK = 6;
const MAX_KOPIJA = 24;

const nasumicni = (abeceda) => abeceda[Math.floor(Math.random() * abeceda.length)];

// 9. hex znak uuid-a, bez crtica. Prazno kad uuid nije upotrebljiv — takva se
// karta tretira kao original i nikad se ne prijavljuje kao kopija.
export const markerZnak = (ticketUuid) => {
    const hex = String(ticketUuid || '').replace(/-/g, '').toUpperCase();
    return hex.length >= 9 ? hex[8] : '';
};

// Sufiks originala: srednji znak mora biti različit od markera, inače bi original
// slučajno ispao kopija — pogodio bi ga jedan od šesnaest.
export const suffixOriginala = (ticketUuid) => {
    const marker = markerZnak(ticketUuid);
    const dozvoljeni = marker ? HEX16.split('').filter((c) => c !== marker).join('') : HEX16;
    return nasumicni(HEX16) + nasumicni(dozvoljeni) + nasumicni(HEX16);
};

// Sufiks kopije: srednji znak je marker, a x i z se biraju tako da im zbroj bude
// redni broj kopije uvećan za pomak. Prvi član je nasumičan koliko raspon
// dopušta, da dvije kopije istog rednog broja ne izgledaju identično.
export const suffixKopije = (ticketUuid, copyNo) => {
    const marker = markerZnak(ticketUuid);
    if (!marker) {return null;}
    const n = Number(copyNo);
    if (!Number.isInteger(n) || n < 1 || n > MAX_KOPIJA) {return null;}
    const zbroj = n + POMAK;
    const donja = Math.max(0, zbroj - 15);
    const gornja = Math.min(15, zbroj);
    const x = donja + Math.floor(Math.random() * (gornja - donja + 1));
    return HEX16[x] + marker + HEX16[zbroj - x];
};

// Čitanje sufiksa s papira ili iz QR-a.
//   { isCopy: false }              — original
//   { isCopy: true, copyNo: n }    — kopija, n je redni broj
//   { isCopy: true, copyNo: null } — marker se poklapa, ali x i z nisu znamenke
//                                    ili zbroj ispada besmislen
// Nepostojeći ili neispravan sufiks vraća null — starije karte ga nemaju i to
// nije greška.
export const procitajSuffix = (ticketUuid, suffix) => {
    const s = String(suffix || '').trim().toUpperCase();
    if (s.length !== 3) {return null;}
    if (![...s].every((c) => HEX16.includes(c))) {return null;}
    const marker = markerZnak(ticketUuid);
    if (!marker || s[1] !== marker) {return { isCopy: false, copyNo: null };}
    const x = HEX16.indexOf(s[0]);
    const z = HEX16.indexOf(s[2]);
    if (x < 0 || z < 0) {return { isCopy: true, copyNo: null };}
    const n = x + z - POMAK;
    return { isCopy: true, copyNo: n >= 1 && n <= MAX_KOPIJA ? n : null };
};

// Broj karte kakav ide na papir. Bez sufiksa vraća broj kakav je i bio.
export const brojZaIspis = (ticketCode, suffix) =>
    suffix ? `${ticketCode || ''} ${suffix}` : String(ticketCode || '');

// QR nosi uuid i još šest polja odvojenih točka-zarezom; sufiks se dopisuje kao
// osmo. Validacija uzima prvo polje, pa je dodatak bezopasan i za stare čitače.
// Ako QR već ima osmo polje, ne dira se.
const QR_POLJA_BEZ_SUFIKSA = 7;

export const qrSaSuffixom = (ticketQr, suffix) => {
    const qr = String(ticketQr || '');
    if (!suffix) {return qr;}
    const polja = qr.split(';');
    if (polja.length > QR_POLJA_BEZ_SUFIKSA) {return qr;}
    while (polja.length < QR_POLJA_BEZ_SUFIKSA) {polja.push('');}
    polja.push(suffix);
    return polja.join(';');
};

// Sufiks pročitan iz QR-a; prazno kad ga karta nema.
export const suffixIzQr = (ticketQr) => {
    const polja = String(ticketQr || '').split(';');
    return polja.length > QR_POLJA_BEZ_SUFIKSA ? polja[QR_POLJA_BEZ_SUFIKSA] : '';
};
