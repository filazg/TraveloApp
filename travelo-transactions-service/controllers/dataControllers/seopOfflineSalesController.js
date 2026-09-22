const { getModels } = require("../../dbModels");
const { Op } = require("sequelize");

// Popis povlaštenih karata prodanih bez provjere u SEOP-u — Kontrola →
// „Offline prodaja".
//
// Zapis se ne vodi zasebno: karta već nosi `seop_offline`, pa je ona sama
// evidencija. Dodatna tablica bi značila drugo mjesto na kojem ista činjenica
// može biti drukčija, a i pokrivala bi samo prodaje nastale nakon uvođenja.
//
// Tri su načina na koja karta završi ovdje, i razlikuju se po tome što je
// blagajna znala u trenutku prodaje:
//   popust    — čip je pročitan, pravo poznato, postotak uzet iz lokalnog
//               šifarnika (seop_popust_izvor = "lokalni_katalog");
//   bez_prava — izdana na povjerenje uz razlog, bez popusta (uvijek_prodaj);
//               popust se nije mogao odrediti;
//   ostalo    — offline karta koja ne ulazi ni u jedno od prethodnog.
const VRSTE = ["popust", "bez_prava", "ostalo"];

const vrstaKarte = (t) => {
    if (t.seop_popust_izvor === "lokalni_katalog") return "popust";
    if (t.seop_uvijek_prodaj === true) return "bez_prava";
    return "ostalo";
};

const listSeopOfflineSalesController = async (req, res) => {
    try {
        const { TicketsModel } = getModels();

        const where = { seop_offline: true };

        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        // "Do" je uključiv — obuhvati cijeli dan, kao i u ostalim pregledima
        // Kontrole. Bez toga zapisi iz zadnjeg dana ispadnu iz raspona.
        if (to && !isNaN(to)) to.setHours(23, 59, 59, 999);
        if (from && !isNaN(from) && to && !isNaN(to)) {
            where.createdAt = { [Op.between]: [from, to] };
        } else if (from && !isNaN(from)) {
            where.createdAt = { [Op.gte]: from };
        } else if (to && !isNaN(to)) {
            where.createdAt = { [Op.lte]: to };
        }

        const rows = await TicketsModel.findAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: 1000,
            raw: true,
        });

        // Vrsta se izvodi iz zapisa, pa se filtrira nakon dohvata — uvjet bi u
        // SQL-u bio tri odvojena izraza nad istim redom, a razlika u broju
        // redaka je ovdje nebitna (gornja granica je ista).
        const trazena = VRSTE.includes(req.query.vrsta) ? req.query.vrsta : null;
        const sve = rows.map((t) => ({ ...t, vrsta: vrstaKarte(t) }));
        const sales = trazena ? sve.filter((t) => t.vrsta === trazena) : sve;

        const counts = sve.reduce((acc, t) => {
            acc[t.vrsta] = (acc[t.vrsta] || 0) + 1;
            return acc;
        }, {});

        res.send({ status: 200, data: { sales, counts } });
    } catch (error) {
        console.log("listSeopOfflineSalesController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listSeopOfflineSalesController };
