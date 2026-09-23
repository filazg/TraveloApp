const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");
const { KATALOG, pravoJeRezidentsko, opisPrava, razredPrava } = require("./katalogPrava");

// Popusti po pravu — spoj kataloga prava (ovdje) i postotaka koje je ured upisao
// (boat servis, tablica `seop_right_discounts`).
//
// Dva korisnika, dva oblika:
//   katalogSPopustima() — za portal: SVA prava iz kataloga, svako sa svojim
//                         postotkom ili nulom, da ekran ima što prikazati.
//   popustiZaUredaje()  — za blagajnu i mobilnu: samo prava kojima je postotak
//                         stvarno upisan i uključen. Uređaj nosi popis u sebi i
//                         po njemu offline računa cijenu, pa mu prazni redci
//                         nisu ni od kakve koristi.
//
// Uz postotak ide i `rezident` iz kataloga: linija u modu „prebivalište" priznaje
// samo rezidentska prava, a bez mreže tu odluku nema tko drugi donijeti.
const TRAJANJE_MS = 30000;

let spremljeno = null;
let spremljenoU = 0;

async function dohvatiUpisanePopuste({ svjeze = false } = {}) {
    if (!svjeze && spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;

    const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
    if (!boatUrl) throw new Error("boat servis nije u konfiguraciji");

    const r = await axios.get(`${boatUrl}/seop_right_discounts`, {
        timeout: 8000,
        validateStatus: () => true,
    });
    if (r.status >= 400) throw new Error(`boat /seop_right_discounts je odgovorio statusom ${r.status}`);

    spremljeno = r.data?.data?.discounts || [];
    spremljenoU = Date.now();
    return spremljeno;
}

const zaboraviPopuste = () => { spremljeno = null; spremljenoU = 0; };

// Cijeli katalog s pridruženim postotkom — portal prikazuje i prava koja još
// nemaju upisan popust, inače ured ne bi znao da postoje.
async function katalogSPopustima() {
    const upisani = await dohvatiUpisanePopuste({ svjeze: true });
    const poSifri = new Map(upisani.map((r) => [String(r.code).trim(), r]));

    const prava = Object.keys(KATALOG).map((code) => {
        const upis = poSifri.get(code) || null;
        return {
            code,
            opis: opisPrava(code),
            razred: razredPrava(code),
            rezident: pravoJeRezidentsko(code),
            ticket_label: upis?.ticket_label || null,
            discount_pct: upis ? Number(upis.discount_pct) || 0 : 0,
            is_active: upis ? upis.is_active !== false : true,
            upisano: !!upis,
        };
    });

    // Šifra koju je ured upisao, a katalog je (još) ne poznaje — Pravilnik se
    // mijenja neovisno o nama, pa se takav redak mora vidjeti, ne progutati.
    for (const upis of upisani) {
        const code = String(upis.code).trim();
        if (KATALOG[code]) continue;
        prava.push({
            code,
            opis: null,
            razred: razredPrava(code),
            rezident: false,
            ticket_label: upis.ticket_label || null,
            discount_pct: Number(upis.discount_pct) || 0,
            is_active: upis.is_active !== false,
            upisano: true,
            izvan_kataloga: true,
        });
    }

    return prava.sort((a, b) => a.code.localeCompare(b.code));
}

// Popis za uređaje — samo ono po čemu se offline može računati.
async function popustiZaUredaje() {
    const upisani = await dohvatiUpisanePopuste();
    return upisani
        .filter((r) => r.is_active !== false)
        .map((r) => {
            const code = String(r.code).trim();
            return {
                code,
                // Naziv koji uredaj ispisuje umjesto sifre prava.
                ticket_label: r.ticket_label || null,
                discount_pct: Number(r.discount_pct) || 0,
                // Uređaj po ovome odlučuje smije li pravo proći na liniji u modu
                // „prebivalište". Nepoznata šifra nije rezidentska — uže
                // tumačenje, koje ne dodjeljuje povlasticu koju linija nije
                // prihvatila.
                rezident: pravoJeRezidentsko(code),
                opis: opisPrava(code),
            };
        });
}

module.exports = { katalogSPopustima, popustiZaUredaje, zaboraviPopuste };
