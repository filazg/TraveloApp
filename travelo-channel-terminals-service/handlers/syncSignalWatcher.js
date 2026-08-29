const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configServices/configSyncController");
const { ocistiMemorijuPlovidbenogReda } = require("./transportDataHandlers");

// Prati javlja li jezgra promjenu i o tome obavjestava sve zainteresirane.
//
// Jedno mjesto za sve: uredaji na otvorenoj vezi dobivaju poruku, a memorija
// slozenog plovidbenog reda se brise. Bez tog brisanja uredaj koji na javljanje
// reagira u nekoliko sekundi dobije upravo onu sliku od PRIJE promjene, jer se
// paket drzi minutu — pa izgleda kao da javljanje ne radi.
//
// Pita se jednom za sve uredaje, bez obzira koliko ih je na vezi.
const RAZMAK_MS = 5 * 1000;

const pretplatnici = new Set();
let zadnjiSignali = null;
let mjeric = null;

const dohvatiSignale = async () => {
    const coreConfig = await getCoreServiceConfigData();
    const txUrl = coreConfig?.services?.transactions?.url;
    if (!txUrl) throw new Error("transactions servis nije dostupan");
    const resp = await axios.get(`${txUrl}/sync_signals`, { timeout: 8000 });
    return resp.data?.data?.signals || {};
};

const provjeri = async () => {
    let signali;
    try {
        signali = await dohvatiSignale();
    } catch (e) {
        // Ispad jezgre se NE javlja kao promjena — inace bi svaki prekid
        // pokrenuo osvjezavanje na svim uredajima odjednom.
        console.log("provjera signala nije uspjela:", e?.message || e);
        return;
    }
    const prije = zadnjiSignali;
    zadnjiSignali = signali;
    if (!prije) return signali;
    if (JSON.stringify(prije) === JSON.stringify(signali)) return signali;

    if (Number(signali.transport || 0) !== Number(prije.transport || 0)) {
        ocistiMemorijuPlovidbenogReda();
        console.log("plovidbeni red se promijenio — memorija ocisena");
    }
    for (const javi of pretplatnici) {
        try { javi(signali); } catch (e) { console.log("obavijest pretplatniku nije uspjela:", e?.message || e); }
    }
    return signali;
};

const pokreni = () => {
    if (mjeric) return;
    mjeric = setInterval(() => { provjeri().catch(() => {}); }, RAZMAK_MS);
    mjeric.unref?.();
    provjeri().catch(() => {});
};

const pretplati = (javi) => {
    pretplatnici.add(javi);
    pokreni();
    return () => pretplatnici.delete(javi);
};

// Zadnje poznato stanje — uredaju koji se tek spojio salje se odmah, da zna od
// cega krece.
const zadnjeStanje = async () => {
    if (zadnjiSignali) return zadnjiSignali;
    zadnjiSignali = await dohvatiSignale();
    return zadnjiSignali;
};

module.exports = { pretplati, zadnjeStanje, pokreni };
