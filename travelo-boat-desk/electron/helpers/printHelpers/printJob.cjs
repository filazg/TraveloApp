const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Koliko praznih redova izvuci kad se ne reze — glava printera je nekoliko
// centimetara iznad ruba kucista, pa bez ovoga zadnji redovi ispisa ostanu
// unutra i potrga se preko teksta.
const FEED_LINES = 6;

// Umjesto printer.cut(). Rez se ukljucuje/iskljucuje u postavkama sustava
// (printer_cut) — iskljuci ga kad je cutter u kvaru pa se papir trga rucno.
// Postavka koja jos nije upisana (NULL na staroj instalaciji) znaci ukljucen
// rez, jer je to normalno stanje printera.
const cutOrFeed = (printer, cutEnabled) => {
    if (cutEnabled !== false) {
        printer.cut();
        return;
    }
    for (let i = 0; i < FEED_LINES; i++) {
        printer.newLine();
    }
};

/**
 * Šalje pripremljeni ispis na printer i čeka ishod.
 *
 * Ispis ide na Windows share, a biblioteka odustaje nakon 5 sekundi. Dok se
 * prethodni posao još prenosi, sljedeći zna puknuti na tom timeoutu — tako je
 * račun izlazio, a karta ne. Zato se čeka izvršenje, greška se zapisuje i posao
 * se ponovi umjesto da nestane u praznom catchu.
 *
 * Vraća true/false; pozivatelj odlučuje hoće li javiti operateru.
 */
const runPrintJob = async (printer, label, attempts = 3) => {
    for (let i = 1; i <= attempts; i++) {
        try {
            await printer.execute();
            return true;
        } catch (error) {
            console.log(`PRINT ${label} — pokušaj ${i}/${attempts} nije uspio:`, error?.message || error);
            if (i < attempts) await wait(1500);
        }
    }
    console.log(`PRINT ${label} — ispis nije uspio nakon ${attempts} pokušaja.`);
    return false;
};

module.exports = { runPrintJob, wait, cutOrFeed };
