// HTTP omotac oko sudregClient.lookupByOib. Vraca ravna polja kupca za
// auto-popunu forme, ili { found:false } (nevaljan OIB / fizicka osoba / nema
// u registru) — u kojem slucaju forma ostaje na rucnom unosu.
const { lookupByOib } = require("./sudregClient");

const getSudregLookupController = async (req, res) => {
    const oib = req.query?.oib || req.body?.oib || req.body?.body?.oib;
    if (!oib) {
        return res.send({ status: 400, data: { error: "oib je obavezan" } });
    }
    try {
        const result = await lookupByOib(oib);
        res.send({ status: 200, data: { result } });
    } catch (error) {
        // Greska prema registru (npr. nedostupan servis / kriv config) ne smije
        // blokirati unos — javimo je, a forma pada na rucni unos.
        console.log("sudreg lookup error:", error?.message || error);
        res.send({ status: 502, data: { error: error?.message || "sudreg greska" } });
    }
};

module.exports = { getSudregLookupController };
