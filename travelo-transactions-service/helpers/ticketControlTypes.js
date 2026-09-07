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
    COPY_BY_OTHER_OPERATOR: "copy_by_other_operator",
};

// Naziv za prikaz i kratko objašnjenje. Držano uz ključeve da se ne razilaze.
const OPIS_VRSTE = {
    [VRSTE.COPY_OVER_ORIGINAL]: "Kopija preko originala",
    [VRSTE.ORIGINAL_OVER_COPY]: "Original preko kopije",
    [VRSTE.COPY_OVER_COPY]: "Kopija preko kopije",
    [VRSTE.SAME_ARTIFACT]: "Isti otisak dvaput",
    [VRSTE.CANCELED_TICKET]: "Stornirana karta",
    [VRSTE.MANY_COPIES]: "Previše kopija",
    [VRSTE.COPY_BY_OTHER_OPERATOR]: "Kopiju izdao drugi operater",
};

// Vrste koje nastaju na validaciji — po njima se filtrira ticket_validations.
const VRSTE_VALIDACIJE = [
    VRSTE.COPY_OVER_ORIGINAL,
    VRSTE.ORIGINAL_OVER_COPY,
    VRSTE.COPY_OVER_COPY,
    VRSTE.SAME_ARTIFACT,
    VRSTE.CANCELED_TICKET,
];

// Vrste koje nastaju pri ispisu kopije — po njima se filtrira ticket_copy_prints.
const VRSTE_ISPISA = [
    VRSTE.MANY_COPIES,
    VRSTE.COPY_BY_OTHER_OPERATOR,
];

// Od koje kopije nadalje se ispis smatra uzorkom, a ne slučajnošću. Prva i
// druga kopija se događaju (izgubljena karta, zaglavljen papir); treća već
// traži objašnjenje.
const PRAG_KOPIJA = 3;

module.exports = { VRSTE, OPIS_VRSTE, VRSTE_VALIDACIJE, VRSTE_ISPISA, PRAG_KOPIJA };
