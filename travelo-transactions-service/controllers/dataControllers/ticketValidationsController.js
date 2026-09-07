// Pregled evidentiranih validacija i sukoba — podloga za modul KONTROLA.
//
// Zapisuje ih validateTicketController i ticketCopyPrintController; ovdje se
// samo čitaju. Zaseban kontroler jer se čitanje i pisanje traže s različitih
// strana: pisanje s ukrcaja, čitanje iz ureda.
const { Op } = require("sequelize");
const { getModels } = require("../../dbModels");
const { OPIS_VRSTE, KARTICE, VRSTE_VALIDACIJE, VRSTE_ISPISA, vrsteZaFiltar } = require("../../helpers/ticketControlTypes");

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

// Kontrola kopija karata — objedinjeni popis.
//
// Sukobi nastaju na dva mjesta: na kontroli (drugi pokušaj validacije) i pri
// ispisu kopije (previše kopija, kopija s tuđe blagajne). Portal ih pokazuje u
// jednom popisu s karticama po vrsti, pa se i ovdje spajaju u jedan niz — inače
// bi svaka kartica trebala znati iz koje tablice vuče, a to je znanje koje ne
// pripada sučelju.
//
// Jedan redak po karti i vrsti: ista karta zna imati i previše kopija i sukob na
// ukrcaju, a to su dva različita nalaza.
const listCopyConflictsController = async (req, res) => {
    try {
        const { TicketValidationModel } = getModels();
        const sequelize = TicketValidationModel.sequelize;

        // Portal salje kljuc kartice, ne pojedinu vrstu — jedna kartica zna
        // pokrivati vise vrsta (original i kopija su tri varijante istog nalaza).
        const trazenaVrsta = req.query.type || null;
        const vrsteFiltra = vrsteZaFiltar(trazenaVrsta);
        const replacements = { limit: Math.min(Number(req.query.limit) || 300, 1000) };

        const uvjetiV = ["v.is_conflict = true", "v.conflict_type IS NOT NULL"];
        const uvjetiI = ["p.flag_type IS NOT NULL"];
        if (req.query.from) {
            uvjetiV.push("v.validated_at >= :from");
            uvjetiI.push("p.printed_at >= :from");
            replacements.from = new Date(req.query.from);
        }
        if (req.query.to) {
            const doo = new Date(req.query.to);
            doo.setHours(23, 59, 59, 999);
            uvjetiV.push("v.validated_at <= :to");
            uvjetiI.push("p.printed_at <= :to");
            replacements.to = doo;
        }
        if (vrsteFiltra) {
            uvjetiV.push("v.conflict_type IN (:types)");
            uvjetiI.push("p.flag_type IN (:types)");
            // Prazan popis bi u IN (:types) srusio upit; jedna nepostojeca
            // vrijednost daje prazan rezultat, sto je i tocan odgovor.
            replacements.types = vrsteFiltra.length ? vrsteFiltra : ["__nema__"];
        }

        // Kad kartica pokriva vrste iz samo jedne skupine, druga se ne
        // pretrazuje — prazan upit nad drugom tablicom je cist trosak.
        const trebaValidacije = !vrsteFiltra || vrsteFiltra.some((v) => VRSTE_VALIDACIJE.includes(v));
        const trebaIspise = !vrsteFiltra || vrsteFiltra.some((v) => VRSTE_ISPISA.includes(v));

        // Podaci o originalu su isti za obje skupine: kada je izdan, tko ga je
        // izdao i gdje. Bez toga se iz popisa ne vidi ni je li kopija nastala
        // odmah po prodaji ni je li ju izdalo isto mjesto.
        const KARTA_SELECT = `
                    MIN(COALESCE(i.invoice_date, t."createdAt")) AS ticket_issued_at,
                    MIN(COALESCE(i.invoice_operator_name, i.operater_name, t.sold_by_username)) AS issued_by,
                    MIN(i.invoice_business_premise_name) AS issued_at_premise,
                    MIN(t.ticket_code_suffix)   AS original_suffix,
                    MIN(t.line_code)            AS line_code,
                    MIN(t.departure_harbor_name) AS departure_harbor_name,
                    MIN(t.arrival_harbor_name)  AS arrival_harbor_name,
                    MIN(t.departure)            AS departure,
                    BOOL_OR(t.is_canceled)      AS ticket_canceled,
                    MIN(t.deactivate_data)      AS canceled_at`;

        const upitValidacije = `
            SELECT v.ticket_uuid,
                   v.conflict_type              AS type,
                   MAX(v.ticket_code)           AS ticket_code,
                   COUNT(*)::int                AS event_count,
                   MIN(v.validated_at)          AS first_at,
                   MAX(v.validated_at)          AS last_at,
                   MAX(v.conflict_reason)       AS last_reason,
                   MAX(v.operator)              AS last_operator,
                   MAX(v.terminal_uuid)         AS last_terminal,
${KARTA_SELECT}
            FROM ticket_validations v
            LEFT JOIN tickets t  ON t.ticket_uuid = v.ticket_uuid
            LEFT JOIN invoices i ON i.invoice_uuid = t.invoice_uuid
            WHERE ${uvjetiV.join(" AND ")}
            GROUP BY v.ticket_uuid, v.conflict_type`;

        // Kod ispisa se broje SVE kopije te karte, ne samo oznacene. Oznaku
        // nose tek kopije od praga nadalje, pa bi karta s cetiri kopije
        // pokazivala dvije — a stupac se cita kao "koliko ih je".
        const upitIspisi = `
            SELECT p.ticket_uuid,
                   p.flag_type                  AS type,
                   MAX(p.ticket_code)           AS ticket_code,
                   (SELECT count(*) FROM ticket_copy_prints x
                     WHERE x.ticket_uuid = p.ticket_uuid)::int AS event_count,
                   MIN(p.printed_at)            AS first_at,
                   MAX(p.printed_at)            AS last_at,
                   MAX(p.flag_reason)           AS last_reason,
                   MAX(p.operator_name)         AS last_operator,
                   MAX(p.billing_device_name)   AS last_terminal,
${KARTA_SELECT}
            FROM ticket_copy_prints p
            LEFT JOIN tickets t  ON t.ticket_uuid = p.ticket_uuid
            LEFT JOIN invoices i ON i.invoice_uuid = t.invoice_uuid
            WHERE ${uvjetiI.join(" AND ")}
            GROUP BY p.ticket_uuid, p.flag_type`;

        const dijelovi = [];
        if (trebaValidacije) dijelovi.push(upitValidacije);
        if (trebaIspise) dijelovi.push(upitIspisi);
        if (!dijelovi.length) {
            return res.send({ status: 200, data: { conflicts: [], counts: {} } });
        }

        const redci = await sequelize.query(
            `SELECT * FROM (${dijelovi.join(" UNION ALL ")}) z ORDER BY z.last_at DESC LIMIT :limit`,
            { replacements, type: sequelize.QueryTypes.SELECT },
        );

        // Brojači po vrsti — kartice u portalu pokazuju koliko ih je gdje, pa se
        // računaju ovdje i za neodabrane vrste.
        // Brojaci idu po kartici — sucelje ne zna koje vrste kartica pokriva.
        const counts = {};
        if (!trazenaVrsta) {
            for (const r of redci) {
                const kartica = KARTICE.find((k) => k.types.includes(r.type));
                const kljuc = kartica ? kartica.value : r.type;
                counts[kljuc] = (counts[kljuc] || 0) + 1;
            }
        }

        res.send({
            status: 200,
            data: {
                conflicts: redci.map((r) => ({ ...r, type_label: OPIS_VRSTE[r.type] || r.type })),
                counts,
            },
        });
    } catch (error) {
        console.log("listCopyConflictsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Popis vrsta za kartice u portalu — nazivi žive na poslužitelju da se sučelje i
// pravila ne raziđu.
const listConflictTypesController = async (_req, res) => {
    res.send({
        status: 200,
        data: {
            // Portalu idu kartice, ne pojedine vrste: koja kartica pokriva koje
            // vrste je pravilo, a pravila ne pripadaju sucelju.
            types: KARTICE.map((k) => ({ value: k.value, label: k.label, types: k.types })),
        },
    });
};

module.exports = {
    listTicketValidationsController,
    listCopyConflictsController,
    listConflictTypesController,
};
