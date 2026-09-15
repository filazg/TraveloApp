// Životni ciklus SEOP dojava po karti — jedno mjesto na kojem se provjerava
// smije li se radnja uopće poslati, prije nego se išta ode na akd/SEOP.
//
// Redoslijed je logičan i bez prethodnika nema sljedećeg:
//
//   prodaja ──▶ cvikanje (ukrcaj) ──▶ poništenje ukrcaja
//      └──────▶ storno
//
//   • nema evidencije prodaje (IPK)  → nema ni cvikanja ni storna,
//   • ima prodaje ali nema ukrcaja   → nema poništenja,
//   • karta je cvikana               → otkazuje se poništenjem ukrcaja, ne stornom.
//
// Evidencija je na samoj karti: `seop_ipk` (vraćen iz DojaviProdaje) dokazuje
// prodaju, `seop_cvikanje_transakcija` (vraćen iz DojaviCvikanje) dokazuje ukrcaj.

// Prodaja je dojavljena čim postoji IPK.
const jeProdano = (t) => !!t?.seop_ipk;
// Ukrcaj je dojavljen čim postoji transakcija cvikanja.
const jeCvikano = (t) => !!t?.seop_cvikanje_transakcija;

// Stanje karte u SEOP ciklusu — za prikaz i log.
function seopStanje(t) {
    if (jeCvikano(t)) return 'cvikano';
    if (jeProdano(t)) return 'prodano';
    return 'nedojavljeno';
}

// Smije li se radnja poslati na SEOP za ovu kartu.
// radnja: 'prodaja' | 'cvikanje' | 'storno' | 'ponistenje'
// Vraća { smije, razlog } — razlog je za outbox/log, da se zna zašto je preskočeno.
function smijeRadnju(t, radnja) {
    switch (radnja) {
        case 'prodaja':
            // Linija može koristiti SEOP samo za provjeru iskaznice, bez dojave.
            if (t?.seop_dojava === false) return { smije: false, razlog: 'karta nije označena za SEOP dojavu' };
            // Ista se prodaja ne dojavljuje dvaput — IPK je već tu.
            if (jeProdano(t)) return { smije: false, razlog: 'prodaja je već dojavljena (IPK postoji)' };
            return { smije: true };

        case 'cvikanje':
            if (!jeProdano(t)) return { smije: false, razlog: 'nema evidencije prodaje (IPK) — cvikanje se ne šalje' };
            return { smije: true };

        case 'storno':
            if (!jeProdano(t)) return { smije: false, razlog: 'nema evidencije prodaje (IPK) — storno se ne šalje' };
            // Nakon ukrcaja se karta ne stornira nego poništava — inače bi SEOP
            // imao cvik na storniranoj karti.
            if (jeCvikano(t)) return { smije: false, razlog: 'karta je cvikana — koristi poništenje ukrcaja, ne storno' };
            return { smije: true };

        case 'ponistenje':
            if (!jeCvikano(t)) return { smije: false, razlog: 'nema ukrcaja (cvikanja) — poništenje se ne šalje' };
            return { smije: true };

        default:
            return { smije: false, razlog: `nepoznata radnja: ${radnja}` };
    }
}

module.exports = { smijeRadnju, seopStanje, jeProdano, jeCvikano };
