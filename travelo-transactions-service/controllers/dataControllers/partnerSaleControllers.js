const crypto = require("crypto");
const { reserveBookings } = require("../../helpers/bookingClient");

const randomCode = () => {
    return crypto.randomBytes(5).toString("hex").toUpperCase();
};

const createPartnerSaleController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const body = req.body || {};
        const {
            order_uuid,
            order_number,
            route_uuid,
            departure_date,
            departure_time,
            departure_harbor_code,
            departure_harbor_name,
            arrival_harbor_code,
            arrival_harbor_name,
            arrival_planned = null,
            line_code,
            line_name,
            items,
            customer_name,
            customer_email,
            partner_uuid,
            // Korisnik partnera koji je kartu prodao. Partner ima vise ljudi, a
            // obracun provizije razraduje promet po osobi.
            sold_by_username,
            note,
        } = body;

        if (!order_uuid || !Array.isArray(items) || !items.length) {
            return res.status(400).json({ status: 400, data: { message: "order_uuid and items required" } });
        }

        // Reserve capacity first so overbooking aborts BEFORE creating tickets.
        const reserveItems = items
            .filter((i) => i.ticket_type_uuid && (parseInt(i.qty, 10) || 0) > 0)
            .map((i) => ({ route_uuid, ticket_type_uuid: i.ticket_type_uuid, qty: parseInt(i.qty, 10) }));
        if (reserveItems.length) {
            try {
                await reserveBookings(reserveItems);
            } catch (err) {
                if (err.bookingRejection) {
                    return res.status(409).json({ status: 409, data: { message: err.message } });
                }
                throw err;
            }
        }

        const ticketsToCreate = [];
        const departurePlanned = `${departure_date || ""} ${departure_time || ""}`.trim();

        for (const item of items) {
            const qty = parseInt(item.qty, 10) || 0;
            for (let i = 0; i < qty; i++) {
                const ticket_uuid = crypto.randomUUID();
                const ticket_code = randomCode();
                ticketsToCreate.push({
                    ticket_uuid,
                    ticket_code,
                    order_uuid,
                    order_number: order_number || null,
                    ticket_group_uuid: item.ticket_type_uuid,
                    ticket_type_uuid: item.ticket_type_uuid,
                    ticket_type_name: item.ticket_type_name,
                    single_price: item.unit_price,
                    is_active: true,
                    is_canceled: false,
                    route_uuid,
                    departure_planed: departurePlanned,
                    departure: departurePlanned,
                    line_code: line_code || null,
                    line_name: line_name || null,
                    departure_harbor_id: departure_harbor_code,
                    departure_harbor_name,
                    arrival_planed: arrival_planned || null,
                    arrival: arrival_planned || null,
                    arrival_harbor_id: arrival_harbor_code,
                    arrival_harbor_name,
                    deactivate: false,
                    status: "created",
                    ticket_qr: ticket_uuid,
                    passanger_email: customer_email || null,
                    passanger_name: customer_name || null,
                    partner_uuid: partner_uuid || null,
                    sold_by_username: sold_by_username || null,
                    partner_invoice_uuid: null,
                    order_note: note || null,
                });
            }
        }

        const created = await TicketsModel.bulkCreate(ticketsToCreate);

        res.status(200).json({
            status: 200,
            data: {
                order_uuid,
                tickets: created.map(t => ({
                    ticket_uuid: t.ticket_uuid,
                    ticket_code: t.ticket_code,
                    ticket_type_name: t.ticket_type_name,
                    single_price: t.single_price,
                })),
            },
        });
    } catch (error) {
        console.log("createPartnerSaleController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const listTicketsForOrderController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const order_uuid = req.query.order_uuid || req.params.order_uuid;
        if (!order_uuid) {
            return res.status(400).json({ status: 400, data: { message: "order_uuid required" } });
        }
        const tickets = await TicketsModel.findAll({
            where: { order_uuid, is_active: true },
            order: [["id", "ASC"]],
        });
        res.status(200).json({ status: 200, data: { tickets } });
    } catch (error) {
        console.log("listTicketsForOrderController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    createPartnerSaleController,
    listTicketsForOrderController,
};
