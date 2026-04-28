// Šifrarnik namjena (vrsta) putnih karata u SEOP sustavu — v3.0, tablica 5.
// Ova šifra se šalje kao `namjena` parametar u DojaviProdajuOPK* / DojaviProdajuPPK_3*.
// Grupirano po kategoriji radi preglednijeg dropdowna.

export const SEOP_TYPES = [
    { group: "Osoba", code: "OOA", label: "Osoba 12+ (odrasli)" },
    { group: "Osoba", code: "OOB", label: "Osoba u autobusu" },
    { group: "Osoba", code: "ODA", label: "Dijete 1–3" },
    { group: "Osoba", code: "ODB", label: "Dijete 3–12" },
    { group: "Osoba", code: "ODD", label: "Dojenče" },
    { group: "Osoba", code: "OOJ", label: "Osoba u vozilu javne službe" },
    { group: "Osoba", code: "OVA", label: "Vozač autobusa/kamiona" },

    { group: "Vozilo – osobno", code: "VMA", label: "Osobni automobil A (do 5 m, 2 t)" },
    { group: "Vozilo – osobno", code: "VMB", label: "Osobni automobil B (preko 5 m / 2 t)" },
    { group: "Vozilo – osobno", code: "VKA", label: "Kamper (M1)" },

    { group: "Vozilo – motori", code: "VLA", label: "Motocikl/moped (do 500 kg)" },
    { group: "Vozilo – motori", code: "VLB", label: "Motor s bočnom prikolicom / četverocikl" },
    { group: "Vozilo – motori", code: "VBA", label: "Bicikl" },

    { group: "Vozilo – autobus", code: "VMC", label: "Autobus 10–17 sjedala" },
    { group: "Vozilo – autobus", code: "VMD", label: "Autobus 18–33 sjedala" },
    { group: "Vozilo – autobus", code: "VME", label: "Autobus 34–54 sjedala" },
    { group: "Vozilo – autobus", code: "VMF", label: "Autobus više od 54 sjedala" },

    { group: "Vozilo – teretno", code: "VNA", label: "Teretni auto do 3 t" },
    { group: "Vozilo – teretno", code: "VNB", label: "Teretni auto do 4 t" },
    { group: "Vozilo – teretno", code: "VNC", label: "Teretni auto do 5 t" },
    { group: "Vozilo – teretno", code: "VND", label: "Teretni auto 6 t i više" },

    { group: "Vozilo – prikolica", code: "VOA", label: "Laka prikolica" },
    { group: "Vozilo – prikolica", code: "VOB", label: "Priključno vozilo" },

    { group: "Ostalo", code: "TOA", label: "Teret općeniti" },
    { group: "Ostalo", code: "DOA", label: "Drugo (npr. kućni ljubimac)" },
];

export const SEOP_TYPE_LABEL = Object.fromEntries(SEOP_TYPES.map((t) => [t.code, t.label]));
