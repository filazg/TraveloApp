const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// PRIVREMENO: cutter na printeru je u kvaru, pa se rez preskace i papir se trga
// rucno. Vraca se na true (ili preko env-a DESK_PRINTER_CUT=1) cim se printer
// popravi — jedino mjesto koje treba dirati.
const CUT_ENABLED = process.env.DESK_PRINTER_CUT === '1';

// Umjesto printer.cut() — kad je rez iskljucen, ostavi malo praznog papira da
// se ima gdje potrgati.
const cutOrFeed = (printer) => {
    if (CUT_ENABLED) {
        printer.cut();
        return;
    }
    printer.newLine();
    printer.newLine();
    printer.newLine();
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

module.exports = { runPrintJob, wait, cutOrFeed, CUT_ENABLED };
