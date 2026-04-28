const { Op } = require("sequelize");

// departure_planed is stored as free-form string; legacy rows use "DD/MM/YYYY HH:mm"
// while newer rows may use "YYYY-MM-DD HH:mm". Match both formats for a given ISO date.
const datePrefixes = (isoDate) => {
    const out = [];
    if (!isoDate) return out;
    const iso = String(isoDate).trim();
    out.push(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (m) out.push(`${m[3]}/${m[2]}/${m[1]}`);
    return out;
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
            if (status && status !== "ALL") where.status = status;
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
