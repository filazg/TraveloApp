const { pretplati, zadnjeStanje } = require("../../handlers/syncSignalWatcher");

// Poslužitelj javlja uređaju, uređaj ne pita.
//
// Uređaj drži otvorenu vezu i dobiva poruku čim se nešto promijeni — storno
// karte, otkaz ili pomak polaska. Bez toga bi svaki uređaj morao stalno pitati,
// pa se s brojem uređaja množi i promet i kašnjenje.
//
// Promjene prati zajednički nadzornik (syncSignalWatcher): pita jezgru jednom za
// sve uređaje i usput briše memoriju složenog plovidbenog reda, da uređaj koji
// odmah reagira ne dobije sliku od prije promjene.
const OTKUCAJ_MS = 20 * 1000;

const posalji = (res, dogadaj, podaci) => {
    try {
        res.write(`event: ${dogadaj}\n`);
        res.write(`data: ${JSON.stringify(podaci)}\n\n`);
    } catch (e) {
        console.log("SSE zapis nije uspio:", e?.message || e);
    }
};

const handleSyncStreamFeature = async (req, res) => {
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Nginx inače skuplja odgovor u međuspremnik i uređaj ne dobije ništa
        // dok se veza ne zatvori.
        "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const odjava = pretplati((signali) => posalji(res, "signals", signali));

    // Prvo stanje odmah, da uređaj zna od čega kreće i ne mora posebno pitati.
    try {
        posalji(res, "signals", await zadnjeStanje());
    } catch (e) {
        posalji(res, "error", { message: "signali trenutno nisu dostupni" });
    }

    // Posrednici (nginx, gateway) zatvaraju tihu vezu; komentar je drži otvorenom,
    // a uređaju služi i kao znak da veza još stoji.
    const otkucaj = setInterval(() => {
        try { res.write(": otkucaj\n\n"); } catch (e) { /* veza je pukla, cisti se nize */ }
    }, OTKUCAJ_MS);

    const zatvori = () => {
        clearInterval(otkucaj);
        odjava();
        try { res.end(); } catch (e) { /* vec zatvoreno */ }
    };
    req.on("close", zatvori);
    req.on("error", zatvori);
};

module.exports = { handleSyncStreamFeature };
