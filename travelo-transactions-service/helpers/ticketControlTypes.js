// Vrste sukoba u kontroli karata. Jedno mjesto istine — i poslužitelj i portal
// koriste iste ključeve, a portal po njima slaže kartice.
//
// Dvije skupine, po tome kad se sukob uopće može utvrditi:
//   - na kontroli (validacija): treba drugi pokušaj da bi se vidio
//   - pri ispisu kopije: vidi se odmah, ne čeka se ukrcaj

const VRSTE = {
    // --- utvrđuje se na kontroli ---
    COPY_OVER_ORIGINAL: "copy_over_original",
    ORIGINAL_OVER_COPY: "original_over_copy",
    COPY_OVER_COPY: "copy_over_copy",
    // Isti otisak očitan drugi put. Namjerno bez tolerancije: fotografija QR-a
    // nosi identičnu oznaku kao original, pa je ponovno očitanje jedini trag
    // koji uopće postoji. Putnik koji dvaput prisloni kartu time upada u popis,
    // ali lažna uzbuna je jeftinija od propuštene.
    SAME_ARTIFACT: "same_artifact",
    // Stornirana karta na ukrcaju.
    CANCELED_TICKET: "canceled_ticket",

    // --- utvrđuje se pri ispisu kopije ---
    MANY_COPIES: "many_copies",
};

// Naziv pojedine vrste — stoji uz redak na kartici "Sve", gdje se u istom
// popisu mijesaju razlicite vrste. Tri varijante sukoba originala i kopije tu
// zadrzavaju svoje precizne nazive: kartica ih objedinjuje, redak ne.
const OPIS_VRSTE = {
    [VRSTE.COPY_OVER_ORIGINAL]: "Kopija preko originala",
    [VRSTE.ORIGINAL_OVER_COPY]: "Original preko kopije",
    [VRSTE.COPY_OVER_COPY]: "Kopija preko kopije",
    [VRSTE.SAME_ARTIFACT]: "Višestruka validacija",
    [VRSTE.CANCELED_TICKET]: "Stornirana karta",
    [VRSTE.MANY_COPIES]: "Višestruke kopije",
};

// Kartice u portalu. Nisu jedna po vrsti: tri varijante sukoba originala i
// kopije su isti nalaz gledan iz različitog kuta — original i kopija su
// istovremeno u optjecaju — pa idu zajedno. Razlog uz svaki redak i dalje kaže
// koja je točno varijanta.
const KARTICE = [
    {
        value: "copy_conflict",
        label: "Validacija ORG/KOP",
        types: [VRSTE.COPY_OVER_ORIGINAL, VRSTE.ORIGINAL_OVER_COPY, VRSTE.COPY_OVER_COPY],
    },
    { value: VRSTE.SAME_ARTIFACT, label: "Višestruka validacija", types: [VRSTE.SAME_ARTIFACT] },
    { value: VRSTE.CANCELED_TICKET, label: "Stornirane karte", types: [VRSTE.CANCELED_TICKET] },
    { value: VRSTE.MANY_COPIES, label: "Višestruke kopije", types: [VRSTE.MANY_COPIES] },
];

// Vrste koje nastaju na validaciji — po njima se filtrira ticket_validations.
const VRSTE_VALIDACIJE = [
    VRSTE.COPY_OVER_ORIGINAL,
    VRSTE.ORIGINAL_OVER_COPY,
    VRSTE.COPY_OVER_COPY,
    VRSTE.SAME_ARTIFACT,
    VRSTE.CANCELED_TICKET,
];

// Vrste koje nastaju pri ispisu kopije — po njima se filtrira ticket_copy_prints.
const VRSTE_ISPISA = [VRSTE.MANY_COPIES];

// Od koje kopije nadalje se ispis smatra uzorkom, a ne slučajnošću. Prva i
// druga kopija se događaju (izgubljena karta, zaglavljen papir); treća već
// traži objašnjenje.
const PRAG_KOPIJA = 3;

// Kartica ili pojedina vrsta → popis vrsta. Portal šalje ključ kartice, a
// ovdje se prevodi; tako sučelje ne mora znati koje vrste kartica pokriva.
const vrsteZaFiltar = (kljuc) => {
    if (!kljuc) return null;
    const kartica = KARTICE.find((k) => k.value === kljuc);
    if (kartica) return kartica.types;
    return Object.values(VRSTE).includes(kljuc) ? [kljuc] : [];
};

module.exports = {
    VRSTE,
    OPIS_VRSTE,
    KARTICE,
    VRSTE_VALIDACIJE,
    VRSTE_ISPISA,
    PRAG_KOPIJA,
    vrsteZaFiltar,
};
