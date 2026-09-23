const { getModels } = require("../../dbModels");
const { Op } = require("sequelize");

// Koliko je na kraju naplaceno i po kojem popustu — to zapis o gresci ne nosi,
// jer greska govori zasto pravo nije provjereno, a ne kako je karta naplacena.
// Kontrolu zanima oboje zajedno: razlog bez iznosa ne pokazuje sto je operater
// dodijelio na povjerenje. Zato se dopunjuje s karte, jednim upitom za cijeli
// popis.
//
// Veza ide preko `ticket_uuid`; stariji zapisi ga nemaju, pa im je `ticket_code`
// jedini trag. Karta koja se ne nade ostaje bez iznosa (prikaz pokazuje "—") —
// nista se ne izmislja.
const dopuniIznosima = async (TicketsModel, zapisi) => {
    const uuidi = [...new Set(zapisi.map((z) => z.ticket_uuid).filter(Boolean))];
    const sifre = [...new Set(zapisi.map((z) => z.ticket_code).filter(Boolean))];
    if (!uuidi.length && !sifre.length) return zapisi;

    const uvjeti = [];
    if (uuidi.length) uvjeti.push({ ticket_uuid: { [Op.in]: uuidi } });
    if (sifre.length) uvjeti.push({ ticket_code: { [Op.in]: sifre } });

    const karte = await TicketsModel.findAll({
        where: { [Op.or]: uvjeti },
        attributes: ["ticket_uuid", "ticket_code", "single_price", "seop_discount_pct",
            "seop_popust_izvor", "seop_redovna_cijena"],
        raw: true,
    });

    const poUuidu = new Map(karte.filter((k) => k.ticket_uuid).map((k) => [k.ticket_uuid, k]));
    const poSifri = new Map(karte.filter((k) => k.ticket_code).map((k) => [k.ticket_code, k]));

    return zapisi.map((z) => {
        const k = (z.ticket_uuid && poUuidu.get(z.ticket_uuid)) || (z.ticket_code && poSifri.get(z.ticket_code)) || null;
        return {
            ...z,
            popust_postotak: k?.seop_discount_pct ?? null,
            popust_izvor: k?.seop_popust_izvor ?? null,
            naplaceno: k?.single_price ?? null,
            redovna_cijena: k?.seop_redovna_cijena ?? null,
        };
    });
};

// Popis otočnih karata izdanih bez provjere — Kontrola → „Greške s povlaštenim
// karticama". Najnovije prvo; filtri po razlogu i rasponu datuma. Uz popis idu i
// brojači po razlogu (kad se dohvaća bez filtra razloga) da kartice u portalu
// mogu pokazati koliko ih je gdje.
const listSeopCardErrorsController = async (req, res) => {
    try {
        const { SeopCardErrorModel, TicketsModel } = getModels();

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
            raw: true,
        });
        const errors = await dopuniIznosima(TicketsModel, rows);

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

        res.send({ status: 200, data: { errors, counts } });
    } catch (error) {
        console.log("listSeopCardErrorsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listSeopCardErrorsController };
