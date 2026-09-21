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
export const blokPovlastice = ({ ishod, cijenaRed, redovnaCijena = null, pratnja = false, uvijekProdaj = false }) => ({
    sustav: ishod?.sustav || "SEOP",
    token: ishod?.token || null,
    identifikator: ishod?.identifikator || null,
    pravo: ishod?.pravo_na_pp || null,
    otok: ishod?.otok || null,
    popust_postotak: uvijekProdaj ? 0 : Number(ishod?.popust_postotak || 0),
    namjena: cijenaRed?.seop_type || null,
    redovna_cijena: Number(redovnaCijena ?? cijenaRed?.price ?? 0),
    odobrenje: ishod?.odobrenje || null,
    uvijek_prodaj: uvijekProdaj,
    offline: ishod?.offline === true,
    pratnja,
    // Linija moze koristiti SEOP samo za provjeru, bez dojave prodaje.
    dojava_seop: ishod?.dojava_seop !== false,
});
