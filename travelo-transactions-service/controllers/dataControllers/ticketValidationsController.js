// Pregled evidentiranih validacija — podloga za modul KONTROLA u portalu.
//
// Zapisuje ih validateTicketController; ovdje se samo čitaju. Zaseban kontroler
// jer se čitanje i pisanje traže s različitih strana: pisanje s ukrcaja, čitanje
// iz ureda.
const { Op } = require("sequelize");
const { getModels } = require("../../dbModels");

const rasponDatuma = (from, to) => {
    if (!from && !to) return null;
    const raspon = {};
    if (from) raspon[Op.gte] = new Date(from);
    if (to) {
        const doo = new Date(to);
        doo.setHours(23, 59, 59, 999);
        raspon[Op.lte] = doo;
    }
    return raspon;
};

const listTicketValidationsController = async (req, res) => {
    try {
        const { TicketValidationModel } = getModels();
        const where = {};
        if (req.query.ticket_uuid) where.ticket_uuid = req.query.ticket_uuid;
        if (req.query.ticket_code) where.ticket_code = { [Op.iLike]: String(req.query.ticket_code).trim() };
        if (req.query.outcome) where.outcome = req.query.outcome;
        // Pregled sukoba je zaseban filtar jer je to ono zbog čega se ovaj popis
        // uopće gleda — ostalo je kontekst.
        if (req.query.conflicts_only === "1" || req.query.conflicts_only === "true") {
            where.is_conflict = true;
        }
        const raspon = rasponDatuma(req.query.from, req.query.to);
        if (raspon) where.validated_at = raspon;

        const redci = await TicketValidationModel.findAll({
            where,
            order: [["validated_at", "DESC"]],
            limit: Math.min(Number(req.query.limit) || 200, 1000),
            offset: Number(req.query.offset) || 0,
        });

        res.send({ status: 200, data: { validations: redci } });
    } catch (error) {
        console.log("listTicketValidationsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Kontrola kopija karata: karte kod kojih se pojavio sukob, s brojem pokušaja i
// zadnjim viđenim. Jedan redak po karti — u portalu se otvara u detalj.
const listCopyConflictsController = async (req, res) => {
    try {
        const { TicketValidationModel } = getModels();
        const sequelize = TicketValidationModel.sequelize;
        const uvjeti = ["v.is_conflict = true"];
        const replacements = {};
        if (req.query.from) { uvjeti.push("v.validated_at >= :from"); replacements.from = new Date(req.query.from); }
        if (req.query.to) {
            const doo = new Date(req.query.to);
            doo.setHours(23, 59, 59, 999);
            uvjeti.push("v.validated_at <= :to");
            replacements.to = doo;
        }

        // Uz sukob ide i podatak o samoj karti — kada je original izdan i na
        // kojoj relaciji. Bez toga se iz popisa ne vidi je li kopija napravljena
        // odmah po prodaji ili danima kasnije, a upravo to razlikuje pogresku od
        // namjere.
        //
        // Vrijeme izdavanja se uzima s racuna; tek ako karta nema racun (jos nije
        // sinkroniziran, partnerska prodaja) pada na trenutak nastanka karte.
        const redci = await sequelize.query(
            `SELECT v.ticket_uuid,
                    MAX(v.ticket_code)          AS ticket_code,
                    COUNT(*)::int               AS conflict_count,
                    MIN(v.validated_at)         AS first_conflict_at,
                    MAX(v.validated_at)         AS last_conflict_at,
                    MAX(v.conflict_reason)      AS last_reason,
                    MAX(v.operator)             AS last_operator,
                    MAX(v.terminal_uuid)        AS last_terminal,
                    MIN(COALESCE(i.invoice_date, t."createdAt")) AS ticket_issued_at,
                    MIN(t.ticket_code_suffix)   AS original_suffix,
                    MIN(t.line_code)            AS line_code,
                    MIN(t.departure_harbor_name) AS departure_harbor_name,
                    MIN(t.arrival_harbor_name)  AS arrival_harbor_name,
                    MIN(t.departure)            AS departure
             FROM ticket_validations v
             LEFT JOIN tickets t  ON t.ticket_uuid = v.ticket_uuid
             LEFT JOIN invoices i ON i.invoice_uuid = t.invoice_uuid
             WHERE ${uvjeti.join(" AND ")}
             GROUP BY v.ticket_uuid
             ORDER BY MAX(v.validated_at) DESC
             LIMIT :limit`,
            {
                replacements: { ...replacements, limit: Math.min(Number(req.query.limit) || 200, 1000) },
                type: sequelize.QueryTypes.SELECT,
            },
        );

        res.send({ status: 200, data: { conflicts: redci } });
    } catch (error) {
        console.log("listCopyConflictsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    listTicketValidationsController,
    listCopyConflictsController,
};
