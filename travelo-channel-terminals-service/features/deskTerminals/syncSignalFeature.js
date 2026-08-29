const axios = require("axios");
const { getCoreServiceConfigData } = require("../../controllers/configServices/configSyncController");

// Lagana provjera "je li se sto promijenilo".
//
// Uredaj je zove cesto — svakih pola minute — pa mora biti jeftina: odgovor je
// nekoliko bajtova, a rezultat se drzi u memoriji nekoliko sekundi da stotinu
// uredaja ne znaci stotinu upita u bazu. Kad se brojac pomakne, uredaj tek tada
// povlaci prave podatke.
const MEMORIJA_MS = 5 * 1000;
let zadnji = null;
let osvjezeno = 0;

const dohvatiSignale = async () => {
    if (zadnji && Date.now() - osvjezeno < MEMORIJA_MS) return zadnji;
    const coreConfig = await getCoreServiceConfigData();
    const txUrl = coreConfig?.services?.transactions?.url;
    if (!txUrl) throw new Error("transactions servis nije dostupan");
    const resp = await axios.get(`${txUrl}/sync_signals`, { timeout: 8000 });
    zadnji = resp.data?.data?.signals || {};
    osvjezeno = Date.now();
    return zadnji;
};

const handleGetSyncSignalsFeature = async (req, res) => {
    try {
        const signals = await dohvatiSignale();
        res.send({ status: 200, data: { signals } });
    } catch (error) {
        console.log("handleGetSyncSignalsFeature error:", error?.message || error);
        // Uredaj ovu provjeru radi stalno; greska ne smije zvucati kao promjena,
        // inace bi svaki ispad jezgre pokrenuo osvjezavanje na svim uredajima.
        res.status(503).send({ status: 503, data: { message: "signali trenutno nisu dostupni" } });
    }
};

module.exports = { handleGetSyncSignalsFeature };
