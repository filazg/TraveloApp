const { Op } = require("sequelize");

// departure_planed je slobodan tekst i ovisi o tome tko je zapisao redak:
//   "YYYY-MM-DD HH:mm"    — noviji zapisi
//   "DD/MM/YYYY HH:mm"    — stariji zapisi
//   "DD.MM.YYYY. HH:mm"   — POS (desktop/mobile) i boat servis; dan i mjesec
//                           znaju biti bez vodeće nule ("1.9.2026.")
// Za zadani ISO datum vraća sve prefikse da LIKE pogodi bilo koji od formata.
const datePrefixes = (isoDate) => {
    const out = [];
    if (!isoDate) return out;
    const iso = String(isoDate).trim();
    out.push(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (m) {
        const [, y, mm, dd] = m;
        out.push(`${dd}/${mm}/${y}`);
        const d1 = String(parseInt(dd, 10));
        const m1 = String(parseInt(mm, 10));
        for (const d of new Set([dd, d1])) {
            for (const mo of new Set([mm, m1])) {
                out.push(`${d}.${mo}.${y}.`);
            }
        }
    }
    return [...new Set(out)];
};

// Status karte pišu tri servisa i dva klijenta, svaki svojim zapisom:
//   POS/boat-desk → ISSUED | VALIDATE | CANCELED
//   validateTicketController → validated
//   cancelTicketsController → canceled
//   dispatcherController (otkaz polaska) → trip_canceled
//   partnerski računi → issued
// Filtar zato ne smije biti egzaktna usporedba — za traženi status vrati sve
// zapise koji mu odgovaraju.
const STATUS_SYNONYMS = {
    issued: ["ISSUED", "issued", "CREATED", "created"],
    validated: ["VALIDATED", "validated", "VALIDATE", "validate"],
    canceled: ["CANCELED", "canceled", "CANCELLED", "cancelled"],
    trip_canceled: ["trip_canceled", "TRIP_CANCELED"],
};
const statusValues = (status) => {
    const key = String(status || "").trim().toLowerCase();
    return STATUS_SYNONYMS[key] || [status];
};

const listTicketsController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const {
            date,
            date_from,
            line_code,
            departure_harbor_id,
            arrival_harbor_id,
            status,
            ticket_code,
            order_uuid,
            partner_uuid,
            route_uuids, // CSV — koristi mobile validacija za sve karte odabranog polaska
            limit,
            offset,
        } = req.query || {};

        const where = {};

        if (ticket_code) {
            where.ticket_code = ticket_code;
        } else if (order_uuid) {
            where.order_uuid = order_uuid;
        } else {
            const dIso = date_from || date;
            if (!dIso) {
                return res.status(400).json({
                    status: 400,
                    data: { message: "date required unless ticket_code/order_uuid provided" },
                });
            }
            const prefixes = datePrefixes(dIso);
            where[Op.or] = prefixes.map((p) => ({
                departure_planed: { [Op.like]: `${p}%` },
            }));
            if (route_uuids) {
                const list = String(route_uuids)
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (list.length) where.route_uuid = { [Op.in]: list };
            }
            if (line_code) where.line_code = line_code;
            if (departure_harbor_id) where.departure_harbor_id = departure_harbor_id;
            if (arrival_harbor_id) where.arrival_harbor_id = arrival_harbor_id;
            if (status && status !== "ALL") where.status = { [Op.in]: statusValues(status) };
            if (partner_uuid) where.partner_uuid = partner_uuid;
        }

        const lim = Math.min(parseInt(limit, 10) || 1000, 5000);
        const off = parseInt(offset, 10) || 0;

        const { rows, count } = await TicketsModel.findAndCountAll({
            where,
            order: [["departure_planed", "ASC"], ["id", "ASC"]],
            limit: lim,
            offset: off,
        });

        res.status(200).json({
            status: 200,
            data: { tickets: rows, total: count, limit: lim, offset: off },
        });
    } catch (error) {
        console.log("listTicketsController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listTicketsController };
