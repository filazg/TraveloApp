// Koliko je karata stvarno prodano za pojedinu nogu polaska.
//
// Kapetanski modul je "Očekivano" dosad izvodio iz zauzetosti u bookingu —
// razlika zauzetosti između dvije luke, uvećana za iskrcaj. Na liniji s dvije
// luke to ispadne točno, ali je izvedenica: broji rezervirana mjesta, a ne
// karte. Ovdje se broje karte.
//
// Broje se sve prodane karte tog polaska, uključujući one koje su u međuvremenu
// iskorištene na drugom polasku: za taj polazak su prodane i kapetan mora vidjeti
// koliko ih je. Koliko ih od toga neće doći, govori zaseban redak „Validirano na
// drugom polasku", a mjesta su im ionako vraćena u slobodna.
//
// Ne ulaze samo stornirane i deaktivirane karte — one nisu prodane.
const { Op } = require("sequelize");
const { getModels } = require("../../dbModels");

const ticketCountsController = async (req, res) => {
    try {
        const { TicketsModel } = getModels();
        const sirovo = String(req.query.route_uuids || "").trim();
        if (!sirovo) {
            return res.status(400).send({ status: 400, data: { message: "route_uuids required" } });
        }
        const rute = sirovo.split(",").map((s) => s.trim()).filter(Boolean);

        const redci = await TicketsModel.findAll({
            where: {
                route_uuid: { [Op.in]: rute },
                is_canceled: { [Op.not]: true },
            },
            attributes: ["ticket_uuid", "route_uuid", "ticket_type_uuid", "departure_harbor_id"],
        });

        // Ista karta zna postojati u više redaka (dvostruko zapisana prodaja),
        // a putnik je jedan — broji se karta, ne redak.
        const poRuti = {};
        const vidjene = new Set();
        for (const t of redci) {
            if (!t.ticket_uuid || vidjene.has(t.ticket_uuid)) continue;
            vidjene.add(t.ticket_uuid);
            const r = (poRuti[t.route_uuid] ||= { ukupno: 0, po_tipu: {} });
            r.ukupno += 1;
            const tip = t.ticket_type_uuid || "bez_tipa";
            r.po_tipu[tip] = (r.po_tipu[tip] || 0) + 1;
        }

        res.send({ status: 200, data: { counts: poRuti } });
    } catch (error) {
        console.log("ticketCountsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { ticketCountsController };
