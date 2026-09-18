const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Koliko čekamo jedan execute() prije nego ga proglasimo neuspjelim. Bez ovoga
// je execute na nespojenom pisaču znao visjeti bez odgovora (ni greška ni
// timeout iz biblioteke), pa se cijeli ispis računa "vrtio u nedogled" —
// renderer je stajao na spinneru dok createInvoice čeka ispis.
const EXEC_TIMEOUT_MS = 8000;
// Brza provjera veze prije pokušaja — da fail bude za par sekundi, ne za više
// desetaka.
const CONN_TIMEOUT_MS = 4000;

// Odustane od promisea ako ne završi u zadanom roku. Napomena: ne PREKIDA posao
// u biblioteci (nema API za to), samo nas oslobodi čekanja; eventualni kasni
// ishod se ignorira.
const withTimeout = (promise, ms) => Promise.race([
    Promise.resolve().then(() => promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)),
]);

// Koliko praznih redova izvuci kad se ne reze — glava printera je nekoliko
// centimetara iznad ruba kucista, pa bez ovoga zadnji redovi ispisa ostanu
// unutra i potrga se preko teksta.
//
// Podignuto sa 6 na 8: sa 6 je zadnji redak jos znao zavrsiti pretijesno uz
// rub, pa nije bilo gdje uhvatiti papir za trganje.
const FEED_LINES = 8;

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
    // Brza provjera veze: ako pisač očito nije spojen, ne vrtimo execute pokušaje
    // (fail za par sekundi umjesto desetaka). Ako provjera zapne ili baci, ne
    // odustajemo — svejedno pokušamo execute (uz timeout niže), jer za neke
    // sučelja isPrinterConnected zna biti nepouzdan.
    try {
        const connected = await withTimeout(printer.isPrinterConnected(), CONN_TIMEOUT_MS);
        if (connected === false) {
            console.log(`PRINT ${label} — pisač nije spojen, ispis preskočen.`);
            return false;
        }
    } catch (error) {
        console.log(`PRINT ${label} — provjera veze nije uspjela (${error?.message || error}); pokušavam ispis uz timeout.`);
    }

    for (let i = 1; i <= attempts; i++) {
        try {
            await withTimeout(printer.execute(), EXEC_TIMEOUT_MS);
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
