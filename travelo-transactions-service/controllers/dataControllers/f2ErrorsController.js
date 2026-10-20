const { getModels } = require("../../dbModels");
const { Op } = require("sequelize");

// Popis neuspjelih F2 slanja — Kontrola → „F2 greške". Najnovije prvo; filtri
// po fazi (slanje / fiskalizacija) i rasponu datuma. Brojaci po fazi idu samo
// kad se ne filtrira po fazi, inace ne bi bili tocni za druge kartice.
const listF2ErrorsController = async (req, res) => {
    try {
        const { F2ErrorModel } = getModels();

        const where = {};
        if (req.query.faza) where.faza = String(req.query.faza).trim();

        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        // "Do" je ukljuciv — obuhvati cijeli dan.
        if (to && !isNaN(to)) to.setHours(23, 59, 59, 999);
        if (from && !isNaN(from) && to && !isNaN(to)) {
            where.createdAt = { [Op.between]: [from, to] };
        } else if (from && !isNaN(from)) {
            where.createdAt = { [Op.gte]: from };
        } else if (to && !isNaN(to)) {
            where.createdAt = { [Op.lte]: to };
        }

        const errors = await F2ErrorModel.findAll({
            where,
            attributes: { exclude: ["odgovor"] },
            order: [["createdAt", "DESC"]],
            limit: 1000,
            raw: true,
        });

        let counts = {};
        if (!req.query.faza) {
            const svi = await F2ErrorModel.findAll({
                attributes: ["faza"],
                where: where.createdAt ? { createdAt: where.createdAt } : {},
                raw: true,
            });
            counts = svi.reduce((acc, r) => {
                acc[r.faza] = (acc[r.faza] || 0) + 1;
                return acc;
            }, {});
        }

        res.send({ status: 200, data: { errors, counts } });
    } catch (error) {
        console.log("listF2ErrorsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listF2ErrorsController };
