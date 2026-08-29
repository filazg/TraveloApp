const crypto = require("crypto");
const { bezPdv, saljeBezPdva } = require("../../helpers/cijene");
const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");
const { isSaleOpen, saleClosedMessage } = require("../../helpers/departureCutoff");

const createOrderController = async (req, res) => {
    const { OrdersModel, RoutesModel, TimetablePricesModel } = req.app.locals.models;
    try {
        const body = req.body || {};
        const items = Array.isArray(body.items) ? body.items : [];

        if (!body.route_uuid || !items.length) {
            return res.status(400).json({ status: 400, data: { message: "route_uuid and items required" } });
        }

        const route = await RoutesModel.findOne({ where: { uuid: body.route_uuid } });
        if (!route) {
            return res.status(404).json({ status: 404, data: { message: "route not found" } });
        }

        // Prodaja se zatvara 10 min prije polaska (Europe/Zagreb). Ovdje prolaze
        // i partnerska i web prodaja, pa je ovo zadnja brana — prodajno sučelje
        // takav polazak više ne nudi, ali korisnik može sjediti na njemu dok
        // cutoff prođe.
        if (!isSaleOpen(route.actual_departure)) {
            console.log("createOrderController odbijen — prodaja zatvorena za", route.actual_departure);
            return res.status(409).json({
                status: 409,
                data: {
                    message: saleClosedMessage(route.actual_departure, body.language),
                    route_uuid: body.route_uuid,
                    actual_departure: route.actual_departure,
                },
            });
        }

        // Re-price on the server — don't trust client totals
        const prices = await TimetablePricesModel.findAll({
            where: {
                timetable_uuid: route.timetable_uuid,
                harbor_from_code: route.departure_harbor_id,
                harbor_to_code: route.arrival_harbor_id,
                is_active: true,
            },
        });
        const priceByTicketType = Object.fromEntries(
            prices.map(p => [p.ticket_type_uuid, p])
        );

        let total = 0;
        const pricedItems = items.map(it => {
            const price = priceByTicketType[it.ticket_type_uuid];
            if (!price) throw new Error(`Unknown ticket_type_uuid: ${it.ticket_type_uuid}`);
            const qty = Math.max(0, parseInt(it.qty, 10) || 0);
            const isIsland = it.is_island === true;
            const discountPct = isIsland ? Number(it.seop_discount_pct || 0) : 0;
            // Otočna karta: cijena iz cjenika (otočna osnovica) × (1 - SEOP popust).
            const unit = isIsland
                ? +((parseFloat(price.price) || 0) * (1 - discountPct / 100)).toFixed(2)
                : (parseFloat(price.price) || 0);
            const subtotal = +(unit * qty).toFixed(2);
            total += subtotal;
            return {
                ticket_type_uuid: price.ticket_type_uuid,
                ticket_type_name: price.ticket_type_name,
                qty,
                unit_price: unit,
                subtotal,
                // Otočna metadata propagira se u finalize → tickets.* za ispis na karti.
                is_island: isIsland,
                seop_card_no: it.seop_card_no || null,
                seop_pravo: it.seop_pravo || null,
                seop_otok: it.seop_otok || null,
                seop_discount_pct: discountPct || null,
            };
        }).filter(i => i.qty > 0);

        if (!pricedItems.length) {
            return res.status(400).json({ status: 400, data: { message: "no quantities selected" } });
        }

        const channel = body.channel || "partner_web";
        // Karte i dalje nose prodajnu cijenu, s PDV-om — po njoj se obracunava
        // provizija i izdaje racun. Partneru koji prodaje u svoje ime iskazuje
        // se nasa cijena prema njemu: bez PDV-a, s luckom pristojbom u sebi.
        const bezPdva = await saljeBezPdva(channel, body.partner_uuid);
        const iznosPremaPartneru = bezPdva
            ? +pricedItems.reduce((z, s) => z + bezPdv(s.unit_price) * s.qty, 0).toFixed(2)
            : +total.toFixed(2);
        // Web sales are finalized only after Monri confirms the payment, so the
        // order lands in a pending state; partner web-sales are paid on credit
        // and stay immediately confirmed.
        const initialStatus = channel === "web" ? "pending_payment" : "created";

        const order = await OrdersModel.create({
            uuid: crypto.randomUUID(),
            note: body.note || null,
            partner_uuid: body.partner_uuid || null,
            partner_name: body.partner_name || null,
            partner_web_user_uuid: body.partner_web_user_uuid || null,
            partner_web_user_username: body.partner_web_user_username || null,
            route_uuid: route.uuid,
            timetable_uuid: route.timetable_uuid,
            line_uuid: route.line_uuid,
            line_code: route.line_code,
            line_name: route.line_name,
            departure_harbor_code: route.departure_harbor_id,
            departure_harbor_name: route.departure_harbor_name,
            arrival_harbor_code: route.arrival_harbor_id,
            arrival_harbor_name: route.arrival_harbor_name,
            departure_date: route.departure_date,
            departure_time: route.departure_time,
            arrival_planned: route.arrival || route.actual_arrival || null,
            items: pricedItems,
            total_amount: iznosPremaPartneru,
            customer_name: body.customer_name || null,
            customer_email: body.customer_email || null,
            customer_phone: body.customer_phone || null,
            status: initialStatus,
            channel,
            payment_reference: body.payment_reference || null,
            language: body.language || null,
            buyer_data: body.buyer_data || null,
        });

        // For partner web-sales, materialize tickets right away (credit billing).
        // Web sales wait for Monri webhook, so we skip the fan-out here.
        let ticketsResult = null;
        if (channel !== "web") {
            try {
                const coreConfig = await getCoreServiceConfigData();
                const txUrl = coreConfig?.services?.transactions?.url;
                if (txUrl) {
                    const resp = await axios.post(`${txUrl}/partner_sale`, {
                        order_uuid: order.uuid,
                        order_number: `PW-${order.id}`,
                        route_uuid: order.route_uuid,
                        departure_date: order.departure_date,
                        departure_time: order.departure_time,
                        arrival_planned: order.arrival_planned,
                        departure_harbor_code: order.departure_harbor_code,
                        departure_harbor_name: order.departure_harbor_name,
                        arrival_harbor_code: order.arrival_harbor_code,
                        arrival_harbor_name: order.arrival_harbor_name,
                        line_code: order.line_code,
                        line_name: order.line_name,
                        line_uuid: order.line_uuid,
                        items: pricedItems,
                        customer_name: order.customer_name,
                        customer_email: order.customer_email,
                        partner_uuid: order.partner_uuid,
                        // Tko je prodao. Partner ima vise korisnika, a obracun
                        // provizije razraduje promet po osobi — bez ovoga karta
                        // zna samo da je prodana "partneru".
                        sold_by_username: order.partner_web_user_username || null,
                        note: order.note,
                    }, { timeout: 8000, validateStatus: () => true });
                    if (resp.status === 200) {
                        ticketsResult = resp.data?.data || resp.data;
                        // Karta u bazi nosi prodajnu cijenu, ali partneru se i u
                        // potvrdi iskazuje ona po kojoj je narucio — bez PDV-a.
                        if (bezPdva && Array.isArray(ticketsResult?.tickets)) {
                            ticketsResult = {
                                ...ticketsResult,
                                tickets: ticketsResult.tickets.map((k) => ({
                                    ...k,
                                    single_price: bezPdv(k.single_price),
                                })),
                            };
                        }
                        await order.update({ status: "confirmed" });
                    } else {
                        console.log("transactions /partner_sale returned", resp.status, resp.data);
                    }
                } else {
                    console.log("transactions service URL not found in core config");
                }
            } catch (txErr) {
                console.log("failed to reach transactions-service:", txErr?.message || txErr);
            }
        }

        res.status(200).json({
            status: 200,
            data: {
                order: {
                    id: order.id,
                    uuid: order.uuid,
                    total_amount: order.total_amount,
                    items: order.items,
                    status: order.status,
                    departure_date: order.departure_date,
                    departure_time: order.departure_time,
                    departure_harbor_name: order.departure_harbor_name,
                    arrival_harbor_name: order.arrival_harbor_name,
                    tickets: ticketsResult?.tickets || [],
                    tickets_pdf_url: `/transactions/tickets_pdf/${order.uuid}`,
                },
            },
        });
    } catch (error) {
        console.log("createOrderController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message || "internal error" } });
    }
};

const listOrdersController = async (req, res) => {
    const { OrdersModel } = req.app.locals.models;
    try {
        const where = {};
        if (req.query.partner_uuid) where.partner_uuid = req.query.partner_uuid;
        if (req.query.partner_web_user_uuid) where.partner_web_user_uuid = req.query.partner_web_user_uuid;
        if (req.query.payment_reference) where.payment_reference = req.query.payment_reference;
        const orders = await OrdersModel.findAll({
            where,
            order: [["id", "DESC"]],
            limit: parseInt(req.query.limit, 10) || 100,
        });
        res.status(200).json({ status: 200, data: { orders } });
    } catch (error) {
        console.log("listOrdersController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    createOrderController,
    listOrdersController,
};
