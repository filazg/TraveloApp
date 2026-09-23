// Sifarnici analitike iz SAOP-a (mjesta troska, nositelji, referenti).
//
// Sluze samo za izbor u portalu: linija dobiva nositelja, naplatni uredaj
// mjesto troska, operater referenta. Citanje, nikad pisanje — matične podatke
// u iCenteru vodi knjigovodstvo.
const { dohvatiSifarnik, VRSTE_SIFARNIKA } = require("./seyforClient");

const getSeyforCodebookController = async (req, res) => {
    const vrsta = String(req.query.kind || "").trim();
    if (!VRSTE_SIFARNIKA.includes(vrsta)) {
        return res.status(400).send({
            status: 400,
            data: { message: `Ocekujem kind: ${VRSTE_SIFARNIKA.join(" | ")}` },
        });
    }
    try {
        // `?refresh=1` preskace kratkotrajnu memoriju — za slucaj da je
        // knjigovodstvo upravo otvorilo novo mjesto troska.
        const podaci = await dohvatiSifarnik(vrsta, { svjeze: String(req.query.refresh || "") === "1" });
        return res.send({ status: 200, data: podaci });
    } catch (error) {
        console.log("getSeyforCodebookController error:", error?.message || error);
        return res.status(502).send({
            status: 502,
            data: { message: error?.message || "SAOP sifarnik nije dostupan." },
        });
    }
};

module.exports = { getSeyforCodebookController };
