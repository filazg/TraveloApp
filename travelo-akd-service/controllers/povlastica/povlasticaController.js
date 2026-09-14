const { provjeriPovlasticu } = require("./provjeraPovlastice");
const { otvoriPecat } = require("./pecat");

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

module.exports = { provjeriPovlasticuController, otvoriPovlasticuController };
