// Radnje koje se mogu dodijeliti funkcijskoj tipki.
//
// Tipka ne poziva funkciju izravno — handleri žive u FilterBaru i BottomBaru,
// svaki uz svoje stanje. Umjesto da se dižu gore, pritisak tipke upiše signal
// u `shortcutSignal`, a komponenta koja tu radnju zna izvesti reagira na njega.
// Signal nosi i vrijeme, da dva uzastopna pritiska iste tipke budu dvije
// različite vrijednosti i drugi put stvarno okine.

export const FUNKCIJSKE_TIPKE = [
    "F1", "F2", "F3", "F4", "F5", "F6",
    "F7", "F8", "F9", "F10", "F11", "F12",
];

// Fiksne radnje. Sredstva plaćanja se dodaju posebno jer ovise o šifarniku.
export const FIKSNE_RADNJE = [
    { value: "issue",      label: "Izdaj račun" },
    { value: "reset",      label: "Osvježi formu" },
    { value: "r1",         label: "R1 račun (adresar)" },
    { value: "subsidised", label: "Povlaštene kartice" },
    { value: "invoices",   label: "Pregled računa" },
    { value: "tickets",    label: "Pregled karata" },
    { value: "shifts",     label: "Smjene" },
];

// Puni popis za dropdown: fiksne radnje + jedno sredstvo plaćanja po retku iz
// šifarnika. Sredstvo se pamti po uuid-u, pa preimenovanje ne razbija prečac.
export const svePonudjeneRadnje = (paymentMethods = []) => [
    ...FIKSNE_RADNJE,
    ...paymentMethods
        .filter((p) => p?.uuid)
        .map((p) => ({ value: `payment:${p.uuid}`, label: `Plaćanje: ${p.name}` })),
];

// Koja je tipka dodijeljena radnji — za oznaku na samom gumbu, npr. "KARTICA (F2)".
// Prečaci se pamte kao { tipka: radnja }, a ovdje treba obrnuto; mapa je od 12
// unosa pa se ne isplati držati drugi indeks.
export const tipkaZaRadnju = (shortcuts, action) => {
    if (!shortcuts || !action) return null;
    return Object.keys(shortcuts).find((k) => shortcuts[k] === action) || null;
};

export const nazivRadnje = (value, paymentMethods = []) => {
    if (!value) return "";
    const nadjena = svePonudjeneRadnje(paymentMethods).find((r) => r.value === value);
    // Sredstvo plaćanja koje je u međuvremenu obrisano iz šifarnika.
    return nadjena?.label || value;
};
