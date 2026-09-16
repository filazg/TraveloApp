const { getModels } = require("../../dbModels");
const { Op } = require("sequelize");

// Popis otočnih karata izdanih bez provjere — Kontrola → „Greške s povlaštenim
// karticama". Najnovije prvo; filtri po razlogu i rasponu datuma. Uz popis idu i
// brojači po razlogu (kad se dohvaća bez filtra razloga) da kartice u portalu
// mogu pokazati koliko ih je gdje.
const listSeopCardErrorsController = async (req, res) => {
    try {
        const { SeopCardErrorModel } = getModels();

        const where = {};
        if (req.query.razlog) where.razlog = String(req.query.razlog).trim();

        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        // "Do" je uključiv — obuhvati cijeli dan. Bez ovoga se "2026-09-15" tumači
        // kao ponoć (00:00), pa zapisi iz tog dana nakon ponoći ispadnu iz raspona.
        if (to && !isNaN(to)) to.setHours(23, 59, 59, 999);
        if (from && !isNaN(from) && to && !isNaN(to)) {
            where.createdAt = { [Op.between]: [from, to] };
        } else if (from && !isNaN(from)) {
            where.createdAt = { [Op.gte]: from };
        } else if (to && !isNaN(to)) {
            where.createdAt = { [Op.lte]: to };
        }

        const rows = await SeopCardErrorModel.findAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: 1000,
        });

        // Brojači po razlogu — samo kad se ne filtrira po razlogu (inače bi bili
        // netočni za ostale razloge).
        let counts = {};
        if (!req.query.razlog) {
            const svi = await SeopCardErrorModel.findAll({
                attributes: ["razlog"],
                where: where.createdAt ? { createdAt: where.createdAt } : {},
                raw: true,
            });
            counts = svi.reduce((acc, r) => {
                acc[r.razlog] = (acc[r.razlog] || 0) + 1;
                return acc;
            }, {});
        }

        res.send({ status: 200, data: { errors: rows, counts } });
    } catch (error) {
        console.log("listSeopCardErrorsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listSeopCardErrorsController };
