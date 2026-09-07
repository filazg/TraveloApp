// Broj karte — inačica za blagajnu.
//
// Isti format kao u travelo-transactions-service/helpers/ticketCode.js i u
// travelo-mobile/src/store/localSale.js: dvanaest znakova, mala slova, bez 0/O
// i 1/I. Prije je blagajna izdavala 12 heksadecimalnih znakova, pa se po izgledu
// broja vidjelo odakle je karta.
//
// Mala slova jer se velika pri očitanju miješaju sa znamenkama (B/8, uz već
// izbačene O/0 i I/1).
const crypto = require("crypto");

const ALPHA32 = "abcdefghjklmnpqrstuvwxyz23456789";
const DULJINA = 12;

const nasumicanBroj = (duljina = DULJINA) => {
    let s = "";
    for (let i = 0; i < duljina; i++) s += ALPHA32[crypto.randomInt(0, ALPHA32.length)];
    return s;
};

module.exports = { ALPHA32, DULJINA, nasumicanBroj };
