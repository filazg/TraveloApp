// Katalog predložaka za PDF karte.
//
// Ključ je ono što se sprema u postavke; ime datoteke stoji samo ovdje. Da se
// spremalo ime, predložak koji se preimenuje ili makne ostavio bi u bazi zapis
// koji više ništa ne pogađa.
//
// Postojeći predložak je namjerno ostao netaknut — na njemu vise izdane karte i
// naviknuto oko, pa novi ide uz njega, ne umjesto njega.
const PREDLOSCI = [
    {
        key: "ticket_tamplate_1",
        label: "ticket_tamplate_1",
        description: "Više karata na stranici, kako je oduvijek bilo.",
        file: "ticketsTamplate.ejs",
        // Sažetak nema smisla: karte i tako stanu na malo stranica.
        supports_summary: false,
    },
    {
        key: "ticket_tamplate_2",
        label: "ticket_tamplate_2",
        description: "Svaka karta na svojoj A4 stranici, s većim QR kodom i jasnijim rasporedom.",
        file: "ticketsA4Template.ejs",
        supports_summary: true,
    },
];

const ZADANI = "ticket_tamplate_1";

// Predlošci su se prvo zvali po izgledu. Postavke spremljene pod starim
// ključevima i dalje pogađaju svoj predložak — inače bi preimenovanje tiho
// vratilo sve kanale na zadani.
const STARI_KLJUCEVI = {
    compact: "ticket_tamplate_1",
    a4_single: "ticket_tamplate_2",
};

const predlozak = (key) => {
    const trazen = STARI_KLJUCEVI[key] || key;
    return PREDLOSCI.find((p) => p.key === trazen) || PREDLOSCI.find((p) => p.key === ZADANI);
};

// Kanali koji uopće dobivaju PDF kartu. Blagajna i mobilna ispisuju termalno pa
// ih ovdje nema — predložak koji nitko ne koristi samo zbunjuje u postavkama.
const KANALI = [
    { key: "WEB", label: "Web prodaja" },
    { key: "PARTNER", label: "Partnerska prodaja" },
    { key: "URED", label: "Portal / ured" },
];

module.exports = { PREDLOSCI, ZADANI, predlozak, KANALI, STARI_KLJUCEVI };
