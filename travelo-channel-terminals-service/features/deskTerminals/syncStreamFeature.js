const axios = require("axios");
const { getCoreServiceConfigData } = require("../../controllers/configServices/configSyncController");

// Poslužitelj javlja uređaju, uređaj ne pita.
//
// Uređaj drži otvorenu vezu (SSE) i dobiva poruku čim se nešto promijeni —
// storno karte, otkaz ili pomak polaska. Bez toga bi svaki uređaj morao stalno
// pitati, pa se s brojem uređaja množi i promet i kašnjenje.
//
// Iznutra se ipak pita jezgru, ali JEDNOM za sve uređaje: jedan upit svakih pet
// sekundi bez obzira spava li na vezi jedan uređaj ili ih je stotinu. Zašto ne
// događajem iz jezgre: servis se diže u više instanci, a poruka bi stigla samo
// jednoj — uređaji na ostalima ne bi saznali ništa.
const RAZMAK_MS = 5 * 1000;
// Posrednici (nginx, gateway) zatvaraju tihu vezu; komentar svakih 20 s je drži
// otvorenom, a uređaju služi i kao znak da veza još stoji.
const OTKUCAJ_MS = 20 * 1000;

const klijenti = new Set();
let zadnjiSignali = null;
let mjeric = null;

const dohvatiSignale = async () => {
    const coreConfig = await getCoreServiceConfigData();
    const txUrl = coreConfig?.services?.transactions?.url;
    if (!txUrl) throw new Error("transactions servis nije dostupan");
    const resp = await axios.get(`${txUrl}/sync_signals`, { timeout: 8000 });
    return resp.data?.data?.signals || {};
};

const posalji = (res, dogadaj, podaci) => {
    try {
        res.write(`event: ${dogadaj}\n`);
        res.write(`data: ${JSON.stringify(podaci)}\n\n`);
    } catch (e) {
        console.log("SSE zapis nije uspio:", e?.message || e);
    }
};

const pokreniMjeric = () => {
    if (mjeric) return;
    mjeric = setInterval(async () => {
        if (!klijenti.size) return;
        try {
            const signali = await dohvatiSignale();
            const promijenjeno = JSON.stringify(signali) !== JSON.stringify(zadnjiSignali);
            zadnjiSignali = signali;
            if (!promijenjeno) return;
            for (const res of klijenti) posalji(res, "signals", signali);
        } catch (e) {
            // Ispad jezgre se NE javlja uređajima kao promjena — inače bi svaki
            // prekid pokrenuo osvježavanje na svima odjednom.
            console.log("provjera signala nije uspjela:", e?.message || e);
        }
    }, RAZMAK_MS);
    mjeric.unref?.();
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

    klijenti.add(res);
    pokreniMjeric();

    // Prvo stanje odmah, da uređaj zna od čega kreće i ne mora posebno pitati.
    try {
        zadnjiSignali = await dohvatiSignale();
        posalji(res, "signals", zadnjiSignali);
    } catch (e) {
        posalji(res, "error", { message: "signali trenutno nisu dostupni" });
    }

    const otkucaj = setInterval(() => {
        try { res.write(": otkucaj\n\n"); } catch (e) { /* veza je pukla, cisti se nize */ }
    }, OTKUCAJ_MS);

    const zatvori = () => {
        clearInterval(otkucaj);
        klijenti.delete(res);
        try { res.end(); } catch (e) { /* vec zatvoreno */ }
    };
    req.on("close", zatvori);
    req.on("error", zatvori);
};

module.exports = { handleSyncStreamFeature };
