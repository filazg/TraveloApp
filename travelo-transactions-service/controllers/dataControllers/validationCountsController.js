// Koliko je karata ocitano na pojedinom polasku.
//
// Brojac na kapetanskom modulu do sada je citao bookings.validated, koji nitko
// ne puni — i, sto je vaznije, on bi ionako brojao samo karte te voznje. Karta
// propustena s drugog polaska ne pripada njegovim rezervacijama, pa se nigdje
// nije vidjela.
//
// Ovdje se broji po polasku NA KOJEM JE OCITANO (validated_route_uuid), pa
// kapetan vidi i tude karte koje su prosle kroz njegov brod.
const { Op } = require("sequelize");
const { getModels } = require("../../dbModels");

const validationCountsController = async (req, res) => {
    try {
        const { TicketValidationModel } = getModels();
        const sirovo = String(req.query.route_uuids || "").trim();
        if (!sirovo) {
            return res.status(400).send({ status: 400, data: { message: "route_uuids required" } });
        }
        const rute = sirovo.split(",").map((s) => s.trim()).filter(Boolean);

        const redci = await TicketValidationModel.findAll({
            where: {
                validated_route_uuid: { [Op.in]: rute },
                outcome: "validated",
            },
            attributes: ["validated_route_uuid", "other_voyage", "ticket_uuid"],
        });

        // Ista karta se moze pojaviti vise puta (ponovljeno ocitanje je zaseban
        // zapis), a putnik je jedan — broji se karta, ne zapis.
        const poRuti = {};
        const vidjene = new Set();
        for (const r of redci) {
            const kljuc = `${r.validated_route_uuid}|${r.ticket_uuid}`;
            if (vidjene.has(kljuc)) continue;
            vidjene.add(kljuc);
            const c = (poRuti[r.validated_route_uuid] ||= { validated: 0, other_voyage: 0 });
            if (r.other_voyage) c.other_voyage += 1;
            else c.validated += 1;
        }

        // Karte OVOG polaska koje su ocitane negdje drugdje: putnik je kupio
        // ovaj brod, a usao na drugi. Kapetanu to nije svejedno — bez toga ih
        // ceka, jer u njegovim brojkama stoje kao "jos nisu dosli".
        const { TicketsModel } = getModels();
        const drugdje = await TicketValidationModel.findAll({
            where: { other_voyage: true, outcome: "validated" },
            attributes: ["ticket_uuid", "validated_route_uuid"],
        });
        const uuidi = [...new Set(drugdje.map((v) => v.ticket_uuid).filter(Boolean))];
        const poRutiDrugdje = {};
        if (uuidi.length) {
            const karte = await TicketsModel.findAll({
                where: { ticket_uuid: { [Op.in]: uuidi }, route_uuid: { [Op.in]: rute } },
                attributes: ["ticket_uuid", "route_uuid"],
            });
            const rutaKarte = new Map(karte.map((k) => [k.ticket_uuid, k.route_uuid]));
            const brojane = new Set();
            for (const v of drugdje) {
                const svoja = rutaKarte.get(v.ticket_uuid);
                // Ocitanje na vlastitoj ruti nije "drugdje" — takvo i ne bi
                // trebalo nositi oznaku, ali provjera je jeftina.
                if (!svoja || svoja === v.validated_route_uuid) continue;
                if (brojane.has(v.ticket_uuid)) continue;
                brojane.add(v.ticket_uuid);
                poRutiDrugdje[svoja] = (poRutiDrugdje[svoja] || 0) + 1;
            }
        }
        for (const [ruta, n] of Object.entries(poRutiDrugdje)) {
            (poRuti[ruta] ||= { validated: 0, other_voyage: 0 }).validated_elsewhere = n;
        }

        res.send({ status: 200, data: { counts: poRuti } });
    } catch (error) {
        console.log("validationCountsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { validationCountsController };
