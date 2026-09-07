// Broj karte — oznaka koja se ispisuje ispod QR koda i prepisuje rukom kad QR
// ne prolazi.
//
// Jedan format za sve vlastite kanale: 12 znakova iz abecede bez 0/O i 1/I.
// Prije je svaki kanal imao svoj — blagajna 12 hex, POS/web/partner 10 hex,
// mobilna 10 iz ove abecede — pa se po duljini i izgledu vidjelo odakle je
// karta, a jedan od njih je bio i premalen.
//
// Deset heksadecimalnih znakova daje prostor od 1,1 × 10¹². Na 500 000 izdanih
// karata vjerojatnost sudara je oko 11 % — a sudar znači da kontrola po broju
// karte nađe krivu kartu. Dvanaest znakova ove abecede daje 1,2 × 10¹⁸, gdje je
// sudar praktički nemoguć.
//
// T4B API namjerno zadržava svoj format: `ticket_code` se vraća partnerima po
// dokumentaciji v1.05 i mijenja se tek kad ih se obavijesti.
const crypto = require("crypto");

// Bez 0/O i 1/I — broj se čita s papira i prepisuje rukom.
//
// Mala slova, ne velika: velika se pri očitanju miješaju sa znamenkama (B/8, uz
// već izbačene O/0 i I/1). Kod malih slova ta sličnost nestaje.
//
// Traženje po broju karte ide bez razlike velikih i malih slova (`iLike`), pa
// ranije izdane karte s velikim slovima i dalje rade.
const ALPHA32 = "abcdefghjklmnpqrstuvwxyz23456789";
const DULJINA = 12;

const nasumicanBroj = (duljina = DULJINA) => {
    let s = "";
    for (let i = 0; i < duljina; i++) s += ALPHA32[crypto.randomInt(0, ALPHA32.length)];
    return s;
};

// Broj koji sigurno nije zauzet. Uz ovu abecedu i duljinu sudar je toliko
// nevjerojatan da se prva provjera gotovo uvijek prođe; petlja stoji jer je
// jeftina, a jedini drugi ishod je pogrešno pronađena karta na kontroli.
const jedinstvenBroj = async (TicketsModel, pokusaja = 5) => {
    for (let i = 0; i < pokusaja; i++) {
        const kod = nasumicanBroj();
        const postoji = await TicketsModel.findOne({
            where: { ticket_code: kod },
            attributes: ["id"],
        });
        if (!postoji) return kod;
    }
    // Pet sudara zaredom nije statistika nego kvar — bolje puknuti nego izdati
    // kartu s brojem koji već postoji.
    throw new Error("ne mogu dodijeliti jedinstven broj karte");
};

module.exports = { ALPHA32, DULJINA, nasumicanBroj, jedinstvenBroj };
