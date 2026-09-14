const { provjeriPPP } = require("../seop/provjeriPPP");
const { pravilaZaLiniju } = require("./pravilaLinije");
const { pravoJeRezidentsko, opisPrava, razredPrava } = require("./katalogPrava");
const { zapecati, TRAJANJE_MS } = require("./pecat");

// Jedna provjera povlastice za sve prodajne kanale.
//
// Blagajna pita „smije li ovaj putnik povlaštenu kartu na ovoj relaciji", a
// natrag dobiva gotovu odluku: smije/ne smije, koliki popust, putuje li pratnja
// besplatno — i zapečaćeni zapis koji uz prodaju vraća nepromijenjen.
//
// Sve što dojava SEOP-u poslije zatraži (a danas ne znamo da će zatražiti)
// dodaje se u zapis ovdje. Zato POS ne mora znati ni što je `namjena`, ni što je
// `oznOdobrenja`, ni kako se računa ZKB.

const VRSTE = ["card_no", "oib", "iks", "uid", "reg_oznaka"];

// Naš naziv identifikatora → ime parametra u SEOP-u.
const uSeopIdentifikator = (vrsta, vrijednost) => {
    switch (vrsta) {
        case "card_no":    return { sBrOtIs: vrijednost };
        case "uid":        return { oznOtIs: vrijednost };
        case "iks":        return { iks: vrijednost };
        case "oib":        return { oib: vrijednost };
        case "reg_oznaka": return { regOzn: vrijednost };
        default:           return {};
    }
};

const odbij = (razlog, dodatno = {}) => ({
    ok: true,
    ima_pravo: false,
    smije_se_prodati: false,
    popust_postotak: 0,
    besplatno: false,
    pratnja_besplatno: false,
    razlog,
    poruka: razlog,
    ...dodatno,
});

async function provjeriPovlasticu(ulaz = {}) {
    const sustav = String(ulaz.sustav || "SEOP").toUpperCase() === "MOSI" ? "MOSI" : "SEOP";
    const vrsta = VRSTE.includes(ulaz.identifikator?.vrsta) ? ulaz.identifikator.vrsta : null;
    const vrijednost = String(ulaz.identifikator?.vrijednost || "").trim();
    const ruta = ulaz.ruta || {};
    const datum = ulaz.datum || new Date().toISOString();

    if (!vrsta || !vrijednost) {
        throw new Error("identifikator.vrsta (card_no|oib|iks|uid|reg_oznaka) i identifikator.vrijednost su obavezni");
    }
    if (!ruta.line_no || !ruta.departure_harbor_code || !ruta.arrival_harbor_code) {
        throw new Error("ruta.line_no, ruta.departure_harbor_code i ruta.arrival_harbor_code su obavezni");
    }

    const pravila = await pravilaZaLiniju(ruta.line_no);

    // Zajednički dio odgovora — linija i identifikator vrijede i kad se odbije.
    const zajednicko = {
        sustav,
        identifikator: { vrsta, vrijednost },
        ruta: {
            line_no: String(ruta.line_no),
            departure_harbor_code: ruta.departure_harbor_code,
            arrival_harbor_code: ruta.arrival_harbor_code,
        },
        datum,
        linija: {
            nadena: pravila.nadena === true,
            seop_mode: pravila.seop_mode,
            mosi_accepted: pravila.mosi_accepted,
            mosi_discount_pct: pravila.mosi_discount_pct,
            mosi_companion_free: pravila.mosi_companion_free,
        },
    };

    const ishod = sustav === "MOSI"
        ? await provjeriMosi({ ulaz, pravila })
        : await provjeriSeop({ vrsta, vrijednost, ruta, datum, pravila });

    const odgovor = { ...zajednicko, ...ishod };

    // Zapis se pečati samo kad je prodaja dopuštena; odbijena provjera nema što
    // nositi u dojavu osim pokušaja, a njega blagajna šalje sama kad operater
    // odluči prodati kartu bez prava.
    if (odgovor.smije_se_prodati) {
        odgovor.token = zapecati({
            sustav,
            identifikator: odgovor.identifikator,
            ruta: odgovor.ruta,
            datum,
            ima_pravo: odgovor.ima_pravo,
            popust_postotak: odgovor.popust_postotak,
            besplatno: odgovor.besplatno,
            pratnja_besplatno: odgovor.pratnja_besplatno,
            pravo_na_pp: odgovor.pravo_na_pp || null,
            otok: odgovor.otok || null,
            kategorija_popusta: odgovor.kategorija_popusta || null,
            poruka: odgovor.poruka || null,
            brojaci: odgovor.brojaci || null,
            linija: odgovor.linija,
            mock: odgovor.mock === true,
        });
        odgovor.vrijedi_do = new Date(Date.now() + TRAJANJE_MS).toISOString();
    }

    return odgovor;
}

async function provjeriSeop({ vrsta, vrijednost, ruta, datum, pravila }) {
    if (pravila.seop_mode === "ne" || !pravila.nadena) {
        return odbij(
            pravila.nadena
                ? "Na ovoj liniji otočne iskaznice se ne priznaju."
                : "Pravila povlastica za ovu liniju nisu postavljena.",
            { pravo_na_pp: null, otok: null }
        );
    }

    const sirovo = await provjeriPPP({
        ...uSeopIdentifikator(vrsta, vrijednost),
        oznLuke1: ruta.departure_harbor_code,
        oznLuke2: ruta.arrival_harbor_code,
        brLinije: String(ruta.line_no),
        datPut: datum,
    });

    const pravo = sirovo.pravo_na_pp || null;
    const razred = razredPrava(pravo);
    const osnovica = {
        pravo_na_pp: pravo,
        pravo_opis: opisPrava(pravo),
        razred,
        otok: sirovo.otok || null,
        kategorija_popusta: sirovo.kategorija_popusta || null,
        poruka: sirovo.poruka || null,
        brojaci: {
            osn_iskoristen: sirovo.broj_osn_iskoristen ?? null,
            dod_iskoristen: sirovo.broj_dod_iskoristen ?? null,
            max_osn: sirovo.max_osn ?? null,
            max_dod: sirovo.max_dod ?? null,
        },
        mock: sirovo.mock === true,
    };

    if (!sirovo.ima_pravo) {
        return { ...odbij(sirovo.poruka || "Iskaznica nema pravo na povlašteni prijevoz.", osnovica) };
    }

    // „Samo otočani s prebivalištem" — SEOP na to ne odgovara izravno, nego se
    // čita iz šifre prava (katalogPrava.js, poglavlje 3. specifikacije).
    if (pravila.seop_mode === "prebivaliste" && !pravoJeRezidentsko(pravo)) {
        // `ima_pravo` ostaje false: iskaznica pravo ima, ali ne na ovoj liniji,
        // a stariji klijent koji gleda samo to polje ne smije prodati povlašteno.
        // Da se razlika ipak vidi, ide zasebno polje.
        return {
            ...odbij(
                `Linija priznaje samo otočane s prebivalištem, a iskaznica nosi pravo ${pravo || "?"}.`,
                osnovica
            ),
            pravo_postoji: true,
        };
    }

    const popust = Number(sirovo.popust_postotak ?? 0);
    return {
        ok: true,
        ima_pravo: true,
        smije_se_prodati: true,
        popust_postotak: popust,
        besplatno: popust >= 100,
        pratnja_besplatno: false,
        ...osnovica,
    };
}

// MOSI nema provjeru pravа web servisom — pravo stoji na samoj kartici, a mi
// dojavljujemo utrošak. Odluka je zato naša: prihvaća li linija MOSI i koliki je
// popust. Vlasnik putuje s popustom, pratnja besplatno (ako je tako postavljeno).
async function provjeriMosi({ ulaz, pravila }) {
    if (!pravila.nadena) {
        return odbij("Pravila povlastica za ovu liniju nisu postavljena.");
    }
    if (!pravila.mosi_accepted) {
        return odbij("Na ovoj liniji MOSI kartice se ne priznaju.");
    }

    const kartica = ulaz.kartica || {};
    const popust = Number(pravila.mosi_discount_pct || 0);

    return {
        ok: true,
        ima_pravo: true,
        smije_se_prodati: true,
        popust_postotak: popust,
        besplatno: popust >= 100,
        pratnja_besplatno: pravila.mosi_companion_free === true,
        pravo_na_pp: kartica.pravo || null,
        pravo_opis: "MOSI — invalidska iskaznica",
        razred: popust >= 100 ? "besplatno" : "popust",
        otok: null,
        kategorija_popusta: null,
        poruka: pravila.mosi_companion_free
            ? `MOSI kartica: popust ${popust}%, pratnja putuje besplatno.`
            : `MOSI kartica: popust ${popust}%.`,
        brojaci: null,
        mock: false,
    };
}

module.exports = { provjeriPovlasticu, VRSTE };
