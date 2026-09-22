// Zajednička logika povlaštenih (otočnih) karata — provjera prava, povlaštena
// cijena, blok povlastice i identifikator s kartice. Izdvojeno iz
// SubsidisedTicketsSelect da isti "money-kod" koriste i prodaja (Način 1) i
// povratna iz košarice (Način 2, IslandReturnFromCart) — bez dupliciranja.

import { v4 as uuid } from "uuid";

// Izgradi karte (glavnu + eventualnu pratnju) iz jednog `data` opisa. Ne dira
// nikakav state — `cardData` (očitana kartica) i `fallbackRoute` (polazna
// relacija kad `data.route` nije zadan) dolaze kao parametri. Koristi je prodaja
// (Način 1, fallbackRoute=selectedTrip) i povratna iz košarice (Način 2, route
// je uvijek u data).
// Razlozi zbog kojih se povlaštena karta izdaje bez potvrđenog prava, i popusti
// koje operater tada smije dati. Stoje ovdje, a ne u pojedinom ekranu, jer se
// ista karta može izdati na tri mjesta (prodaja, povratna uz prodaju, povratna
// iz košarice) — a razlog i postotak moraju svugdje značiti isto, i u Kontroli
// se broje kao jedno.
export const RAZLOZI_GRESKE = [
    { kljuc: "nemoguce_ocitati", naziv: "Nemoguće očitati karticu" },
    { kljuc: "kartica_ostecena", naziv: "Kartica oštećena" },
    { kljuc: "greska_oprema", naziv: "Greška na opremi" },
    { kljuc: "prekid_komunikacije", naziv: "Prekid u komunikaciji" },
];

// Tri stupnja i ništa između: puna otočna cijena, polovica, ili besplatno —
// isti stupnjevi koje SEOP inače vraća po pravu.
export const POPUSTI_POVJERENJE = [
    { pct: 0, naziv: "Puna cijena" },
    { pct: 50, naziv: "Popust 50 %" },
    { pct: 100, naziv: "Besplatno (100 %)" },
];

export const buildIslandTickets = (data, { cardData = null, fallbackRoute = null } = {}) => {
    let cardDataToAdd = {};
    if (data.type === "VIRTUAL CARD") {
        cardDataToAdd = data.card;
        cardDataToAdd.odobrenje = data.odobrenje;
    } else {
        cardDataToAdd = cardData;
    }

    // Ruta iz data.route (povratna: obrnuta relacija / druga linija) ili fallback
    // (polazna prodaja: selectedTrip). sales_route_uuid MORA biti sales_routes.uuid
    // — inače bulkCreate stavki računa pukne na notNull i karta se ne kreira.
    const salesRoute = data.route || fallbackRoute;
    const newTicket = {
        id: 1,
        sales_route_uuid: salesRoute.uuid,
        line_code: salesRoute.line_code,
        line_name: salesRoute.line_name,
        departure: salesRoute.departure,
        departure_harbor_id: salesRoute.departure_harbor_id,
        departure_harbor_name: salesRoute.departure_harbor_name,
        arrival: salesRoute.arrival,
        arrival_harbor_id: salesRoute.arrival_harbor_id,
        arrival_harbor_name: salesRoute.arrival_harbor_name,
        // Povlaštena karta zauzima normalno putničko mjesto (cjenik: tip "Otočani"
        // → kategorija PASSANGER), pa MORA nositi stvarni ticket_type iz cjenika
        // (data.price) — doslovni "SEOP"/"MOSI" nema mapping na kapacitet i booking
        // rezervacija pukne. Oznaku povlastice nose polja povlastica + is_island.
        ticket_type_name: data?.type ? data.type : data.price.ticket_type_name,
        ticket_type_id: data.price.ticket_type_id,
        ticket_type_uuid: data.price.ticket_type_uuid,
        ticket_group_uuid: uuid(),
        // Iznos je izracunat po pravilu linije; `price.price` je samo osnovica.
        single_price: data.free ? 0 : (data.iznos ?? data.price.price),
        total_price: data.free ? 0 : (data.iznos ?? data.price.price),
        total_vat_base: data.free ? 0 : data.price.vat_base,
        total_vat: data.free ? 0 : data.price.vat_amount,
        total_harbor_tax: data.free ? 0 : data.price.port_tax,
        quantity: 1,
        tickets: [{ uuid: uuid(), code: uuid() }],
        card_data: cardDataToAdd,
        is_island: true,
        povlastica: data.povlastica || null,
    };
    const karte = [newTicket];

    // MOSI: vlasnik kartice putuje s popustom, pratnja besplatno.
    if (data.pratnja) {
        karte.push({
            ...newTicket,
            ticket_group_uuid: uuid(),
            ticket_type_name: `${newTicket.ticket_type_name} — pratnja`,
            single_price: 0,
            total_price: 0,
            total_vat_base: 0,
            total_vat: 0,
            total_harbor_tax: 0,
            tickets: [{ uuid: uuid(), code: uuid() }],
            povlastica: { ...(data.povlastica || {}), pratnja: true },
        });
    }
    return karte;
};

// Identifikator s očitane kartice: SEOP nosi broj iskaznice, MOSI serijski broj.
export const identifikatorSKartice = (k) => {
    if (!k?.F2) return null;
    if (k.cardFamily === "SEOP_P") return { sustav: "SEOP", vrsta: "card_no", vrijednost: k.F2.CardNumber };
    if (k.cardFamily === "MOSI") return { sustav: "MOSI", vrsta: "card_no", vrijednost: k.F2.SBr };
    return null;
};

// Jezgra provjere prava — radi nad EKSPLICITNOM rutom (line_no + par luka +
// datum). Ne dira nikakav state; vraća ishod. Koristi je polazna prodaja,
// povratna (Način 1) i povratna iz košarice (Način 2).
export const provjeriKarticuNaRuti = async ({ vrsta, vrijednost, sustav = "SEOP", kartica = null, route, date }) => {
    const broj = String(vrijednost || "").trim();
    if (!broj) return null;
    if (!route?.line_no || !route?.departure_harbor_code || !route?.arrival_harbor_code) {
        return { ok: false, smije_se_prodati: false, poruka: "Nedostaje ruta za provjeru." };
    }
    try {
        const odgovor = await window.api.app.checkIslandCardIPC({
            sustav,
            [vrsta]: broj,
            kartica,
            route,
            date: date || new Date().toISOString(),
        });
        // IPC vraca { ok, data } ili { ok:false, error }.
        const podaci = odgovor?.data ?? odgovor;
        if (odgovor?.ok === false) {
            return { ok: false, offline: true, smije_se_prodati: false, poruka: odgovor.error || "Provjera nije uspjela." };
        }
        if (podaci?.ok === false) {
            return { ok: false, offline: true, smije_se_prodati: false, poruka: podaci.poruka || podaci.error || "Provjera nije uspjela." };
        }
        return { ok: true, offline: false, ...podaci, identifikator: podaci.identifikator || { vrsta, vrijednost: broj } };
    } catch (e) {
        return { ok: false, offline: true, smije_se_prodati: false, poruka: e?.message || "Provjera nije uspjela." };
    }
};

// Odluka o popustu kad se SEOP ne moze pitati.
//
// Online odluku donosi posluzitelj; ovo je jedini slucaj u kojem je blagajna
// donosi sama, i to samo zato sto bez mreze nema koga pitati. Sve sto joj za to
// treba doslo je sinkronizacijom: sifarnik popusta po pravu (basic_data),
// postavke linije (transport_data) i SEOP-otoci luka (transport_data). Cip daje
// sifru prava i otok — nista se ne nagada.
//
// Vraca `{ popust_postotak, primijenjen, razlog }`. Kad popusta nema, razlog
// kaze zasto, da blagajnik na ekranu vidi je li rijec o pravilu linije, o
// nepostavljenom popustu ili o kartici s krivog otoka.
export const popustBezMreze = ({
    popusti = [],
    pravo = null,
    otokKartice = null,
    linija = null,
    luke = [],
} = {}) => {
    // Tri moguca ishoda, i razlika medu njima odreduje sto blagajna nudi:
    //   odluceno + pravo_vrijedi  -> karta se prodaje po pravilima linije
    //   odluceno + !pravo_vrijedi -> kartica na ovoj relaciji nema pravo
    //   !odluceno                 -> nema se po cemu odluciti (ostaje izdavanje uz razlog)
    const neznam = (razlog) => ({ odluceno: false, pravo_vrijedi: false, primjeni_popust: false, popust_postotak: 0, primijenjen: false, razlog });
    const nema = (razlog) => ({ odluceno: true, pravo_vrijedi: false, primjeni_popust: false, popust_postotak: 0, primijenjen: false, razlog });

    if (!linija) {
        return neznam("Postavke linije nisu poznate, pa se pravo ne može odrediti.");
    }
    if (linija.seop_mode === "ne") {
        return nema("Na ovoj liniji otočne iskaznice se ne priznaju.");
    }

    const sifra = String(pravo || "").trim();
    if (!sifra) {
        return neznam("Pravo se nije očitalo s kartice, pa se ne može odrediti.");
    }

    const upis = popusti.find((p) => String(p.code || "").trim() === sifra) || null;

    // „Samo otocani s prebivalistem" — isto pravilo kao na posluzitelju:
    // iskaznica za „Svi otoci" prolazi svugdje, inace pravo mora biti
    // rezidentsko i otok s kartice mora biti otok jedne od luka relacije.
    if (linija.seop_mode === "prebivaliste") {
        const otok = String(otokKartice || "").trim();
        const sviOtoci = /^svi\s*otoci$/i.test(otok);
        if (!sviOtoci) {
            // Je li pravo rezidentsko pise samo u sifarniku; bez njega se ta
            // odluka ne smije nagadati ni u jednom smjeru.
            if (!upis) {
                return neznam(`Za pravo ${sifra} nema podataka u lokalnom šifarniku (Integracije → AKD → SEOP → Popusti).`);
            }
            if (upis.rezident !== true) {
                return nema(`Linija priznaje samo otočane s prebivalištem, a iskaznica nosi pravo ${sifra}.`);
            }
            const otociRelacije = (luke || [])
                .map((l) => String(l?.seop_island || "").trim())
                .filter(Boolean);
            const poklapa = otociRelacije.some((o) => o.toLowerCase() === otok.toLowerCase());
            if (otociRelacije.length && !poklapa) {
                return nema(`Iskaznica je za otok „${otok || "?"}", a linija priznaje otočane s: ${otociRelacije.join(", ")}.`);
            }
        }
    }

    // Pravo vrijedi. Kako se racuna cijena, odlucuje linija — isto pravilo kao s
    // mrezom: ili se na cijenu iz cjenika primijeni postotak, ili vrijedi
    // otocna cijena kakva jest.
    if (linija.seop_apply_discount !== true) {
        return {
            odluceno: true,
            pravo_vrijedi: true,
            primjeni_popust: false,
            popust_postotak: 0,
            primijenjen: false,
            razlog: `Pravo ${sifra} s kartice — linija ne primjenjuje SEOP popust, pa vrijedi otočna cijena iz cjenika.`,
        };
    }

    // Linija popust primjenjuje, ali se postotak ne zna. Prodaja po otocnoj
    // cijeni bi tada naplatila vise nego sto pripada, pa se radije ne odlucuje.
    if (!upis || !(Number(upis.discount_pct) > 0)) {
        return neznam(`Za pravo ${sifra} nije postavljen popust (Integracije → AKD → SEOP → Popusti).`);
    }

    return {
        odluceno: true,
        pravo_vrijedi: true,
        primjeni_popust: true,
        popust_postotak: Number(upis.discount_pct),
        primijenjen: true,
        razlog: `Popust ${Number(upis.discount_pct)}% po pravu ${sifra} — iz lokalnog šifarnika, bez provjere u SEOP-u.`,
    };
};

// Kako se racuna povlastena cijena, odlucuje linija (postavka u portalu), i to je
// striktno ili-ili:
//   primjeni_popust — na cijenu iz cjenika primijeni postotak sa SEOP-a
//   inace           — naplati cijenu iz cjenika, kakva jest
// Nema iznimke za pravo na besplatan prijevoz: kad se popust ne primjenjuje,
// vrijedi cjenik i za njega.
export const cijenaPovlastene = (ishod, cijenaRed) => {
    const osnovica = Number(cijenaRed?.price || 0);
    if (ishod?.primjeni_popust) {
        return +(osnovica * (1 - Number(ishod.popust_postotak || 0) / 100)).toFixed(2);
    }
    return +osnovica.toFixed(2);
};

// Blok koji putuje uz stavku prodaje. Blagajna ga ne tumaci — `token` je
// zapecaceni zapis provjere s posluzitelja i ovdje se samo prenosi dalje. Zato
// nova polja u dojavi ne traze izmjenu blagajne.
//
// `redovnaCijena` se prosljeđuje eksplicitno (kod prodaje iz cjenika relacije,
// kod povratne iz košarice fallback na cijenaRed.price) — helper ne čita state.
//
// `bezMreze` je ishod lokalne odluke (popustBezMreze) kad provjera nije prošla.
// Tada pravo i otok dolaze s čipa, a postotak iz lokalnog šifarnika, pa se to
// mora i zapisati: `popust_izvor` razdvaja popust koji je dao SEOP od onoga koji
// je blagajna odredila sama. Bez te razlike se u Kontroli poslije ne bi znalo
// po čemu je karta naplaćena.
export const blokPovlastice = ({
    ishod,
    cijenaRed,
    redovnaCijena = null,
    pratnja = false,
    uvijekProdaj = false,
    bezMreze = null,
    kartica = null,
    popustNaPovjerenje = 0,
}) => {
    const lokalni = bezMreze?.primijenjen === true;
    // Na povjerenje popust ne dolazi ni od SEOP-a ni iz sifarnika nego ga
    // dodjeljuje operater, pa se i biljezi kao njegova odluka — u Kontroli se
    // mora vidjeti po cemu je karta naplacena.
    const povjerenje = uvijekProdaj && Number(popustNaPovjerenje) > 0;
    const popust = uvijekProdaj
        ? (povjerenje ? Number(popustNaPovjerenje) : 0)
        : (lokalni ? Number(bezMreze.popust_postotak) : Number(ishod?.popust_postotak || 0));

    return {
        sustav: ishod?.sustav || "SEOP",
        token: ishod?.token || null,
        identifikator: ishod?.identifikator || null,
        // Bez mreže provjere nema, pa pravo i otok dolaze s čipa.
        pravo: ishod?.pravo_na_pp || kartica?.BasicRight || null,
        otok: ishod?.otok || kartica?.IslandName || null,
        popust_postotak: popust,
        popust_izvor: popust > 0 ? (povjerenje ? "povjerenje" : lokalni ? "lokalni_katalog" : "seop") : null,
        namjena: cijenaRed?.seop_type || null,
        redovna_cijena: Number(redovnaCijena ?? cijenaRed?.price ?? 0),
        odobrenje: ishod?.odobrenje || null,
        uvijek_prodaj: uvijekProdaj,
        offline: ishod?.offline === true || lokalni,
        pratnja,
        // Linija moze koristiti SEOP samo za provjeru, bez dojave prodaje.
        dojava_seop: ishod?.dojava_seop !== false,
    };
};
