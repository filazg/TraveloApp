const { provjeriPovlasticu } = require("./provjeraPovlastice");
const { otvoriPecat } = require("./pecat");
const { katalogSPopustima, popustiZaUredaje } = require("./popustiPrava");

// Provjera prava — jedini poziv koji blagajna, mobilna i web koriste.
const provjeriPovlasticuController = async (req, res) => {
    try {
        const rezultat = await provjeriPovlasticu(req.body || {});
        res.json({ status: 200, data: rezultat });
    } catch (err) {
        console.log("provjeriPovlasticu error:", err?.message || err);
        res.status(400).json({ status: 400, data: { message: err.message } });
    }
};

// Otvaranje zapisa — koristi ga prodaja i kasnije radnik koji slaže dojavu.
// Klijenti ovo ne zovu; njima je zapis neproziran.
const otvoriPovlasticuController = async (req, res) => {
    const { token } = req.body || {};
    const ishod = otvoriPecat(token);
    if (!ishod.ok) {
        return res.status(400).json({ status: 400, data: { message: ishod.razlog } });
    }
    res.json({ status: 200, data: ishod.podaci });
};

// Katalog prava s upisanim popustima — ekran u portalu (Integracije → AKD →
// SEOP → Popusti). Vraća SVA prava, i ona bez upisanog postotka.
const katalogPravaController = async (_req, res) => {
    try {
        const prava = await katalogSPopustima();
        res.json({ status: 200, data: { rights: prava } });
    } catch (err) {
        console.log("katalogPrava error:", err?.message || err);
        res.status(500).json({ status: 500, data: { message: err.message } });
    }
};

// Popis za blagajnu i mobilnu — samo prava s uključenim popustom. Ide uz
// osnovne podatke uređaja, pa uređaj offline zna koliki popust nosi koje pravo.
const popustiPravaController = async (_req, res) => {
    try {
        const popusti = await popustiZaUredaje();
        res.json({ status: 200, data: { discounts: popusti } });
    } catch (err) {
        console.log("popustiPrava error:", err?.message || err);
        res.status(500).json({ status: 500, data: { message: err.message } });
    }
};

module.exports = {
    provjeriPovlasticuController,
    otvoriPovlasticuController,
    katalogPravaController,
    popustiPravaController,
};
