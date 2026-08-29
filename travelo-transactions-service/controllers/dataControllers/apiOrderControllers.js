const crypto = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");
const { reserveBookings, releaseBookings } = require("../../helpers/bookingClient");
// API partner moze narucivati po nasoj cijeni bez PDV-a; karta nosi prodajnu.
const { izCijeneBezPdv } = require("../../helpers/provizija");
const { saljeBezPdva } = require("../../helpers/partneri");

const randomTicketCode = () => crypto.randomBytes(8).toString("hex");

const fetchRoute = async (route_uuid) => {
    const coreConfig = await getCoreServiceConfigData();
    const url = coreConfig.services.boat.url + "/routes/" + route_uuid;
    const response = await axios.get(url);
    if (response?.data?.status !== 200) return null;
    return response.data.data.route;
};

const fetchRoutesByDeparture = async (departure_uuid) => {
    const coreConfig = await getCoreServiceConfigData();
    const url = coreConfig.services.boat.url + "/departures/" + departure_uuid + "/routes";
    const response = await axios.get(url);
    if (response?.data?.status !== 200) return [];
    return response.data.data.routes || [];
};

const apiCreateOrderController = async (req, res) => {
    const { ApiOrdersModel } = req.app.locals.models;
    try {
        const { partner_uuid, api_user_uuid, order_number, order_items, total_amount } = req.body || {};
        if (!partner_uuid || !order_number || !Array.isArray(order_items) || !order_items.length) {
            return res.status(400).json({ status: 400, data: { msg: "partner_uuid, order_number, order_items required" } });
        }

        const order_uuid = crypto.randomUUID().replace(/-/g, "");

        await ApiOrdersModel.create({
            order_uuid,
            partner_uuid,
            api_user_uuid: api_user_uuid || null,
            order_number,
            total_amount: Number(total_amount || 0),
            order_items: JSON.stringify(order_items),
            status: "DRAFT",
        });

        return res.status(200).json({
            status: 200,
            data: { order_uuid },
        });
    } catch (error) {
        console.log("apiCreateOrderController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { msg: "Internal error" } });
    }
};

const apiGetOrderController = async (req, res) => {
    const { ApiOrdersModel } = req.app.locals.models;
    try {
        const { order_uuid } = req.body || {};
        if (!order_uuid) return res.status(400).json({ status: 400, data: { msg: "order_uuid required" } });
        const order = await ApiOrdersModel.findOne({ where: { order_uuid } });
        if (!order) return res.status(404).json({ status: 404, data: { msg: "Order not found" } });
        return res.status(200).json({
            status: 200,
            data: {
                order_uuid: order.order_uuid,
                partner_uuid: order.partner_uuid,
                order_number: order.order_number,
                total_amount: Number(order.total_amount),
                status: order.status,
            },
        });
    } catch (error) {
        console.log("apiGetOrderController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { msg: "Internal error" } });
    }
};

const apiConfirmOrderController = async (req, res) => {
    const { ApiOrdersModel, TicketsModel } = req.app.locals.models;
    try {
        const { partner_uuid, order_uuid, tid } = req.body || {};
        if (!order_uuid) return res.status(400).json({ status: 400, data: { msg: "order_uuid required" } });

        const order = await ApiOrdersModel.findOne({ where: { order_uuid } });
        if (!order) return res.status(404).json({ status: 404, data: { msg: "Order not found" } });
        if (partner_uuid && order.partner_uuid !== partner_uuid) {
            return res.status(404).json({ status: 404, data: { msg: "Order not found" } });
        }
        if (order.status !== "DRAFT") {
            return res.status(400).json({ status: 400, data: { msg: "Order not in DRAFT state" } });
        }

        let items;
        try {
            items = JSON.parse(order.order_items);
        } catch (_) {
            return res.status(500).json({ status: 500, data: { msg: "Corrupt order_items" } });
        }

        const routeCache = new Map();
        for (const item of items) {
            if (!routeCache.has(item.trip_uuid)) {
                const r = await fetchRoute(item.trip_uuid);
                if (!r) return res.status(404).json({ status: 404, data: { msg: "trip not found: " + item.trip_uuid } });
                routeCache.set(item.trip_uuid, r);
            }
        }

        // Reserve capacity (overbooking → abort before any tickets created).
        const reserveItems = items.map((i) => ({
            route_uuid: i.trip_uuid,
            ticket_type_uuid: i.ticket_type_uuid,
            qty: parseInt(i.quantity, 10) || 0,
        }));
        try {
            await reserveBookings(reserveItems);
        } catch (err) {
            if (err.bookingRejection) {
                return res.status(409).json({ status: 409, data: { msg: err.message } });
            }
            throw err;
        }

        // Ako partneru saljemo cijene bez PDV-a, narucio je po njima, pa se
        // primljeni iznos vraca na prodajnu cijenu — po njoj se obracunava
        // provizija i izdaje racun. Partneru koji dobiva cijene s PDV-om iznos
        // se ne dira.
        const bezPdva = await saljeBezPdva(order.partner_uuid);

        const ticketsToCreate = [];
        const responseTickets = [];
        for (const item of items) {
            const route = routeCache.get(item.trip_uuid);
            const qty = parseInt(item.quantity, 10) || 0;
            for (let i = 0; i < qty; i++) {
                const ticket_uuid = crypto.randomUUID().replace(/-/g, "");
                const ticket_code = randomTicketCode();
                const ticketRow = {
                    ticket_uuid,
                    ticket_code,
                    order_uuid,
                    order_number: order.order_number,
                    ticket_group_uuid: item.ticket_type_uuid,
                    ticket_type_uuid: item.ticket_type_uuid,
                    ticket_type_name: item.ticket_type_name,
                    single_price: bezPdva
                        ? izCijeneBezPdv(item.single_item_price)
                        : item.single_item_price,
                    is_active: true,
                    is_canceled: false,
                    route_uuid: item.trip_uuid,
                    departure_planed: route.actual_departure,
                    departure: route.actual_departure,
                    line_code: route.line_code,
                    line_name: route.line_name,
                    departure_harbor_id: route.departure_harbor_id,
                    departure_harbor_name: route.departure_harbor_name,
                    arrival_planed: route.actual_arrival,
                    arrival: route.actual_arrival,
                    arrival_harbor_id: route.arrival_harbor_id,
                    arrival_harbor_name: route.arrival_harbor_name,
                    deactivate: false,
                    status: "created",
                    ticket_qr: ticket_uuid,
                    partner_uuid: order.partner_uuid,
                    // Kod API prodaje prodavatelj nije osoba nego partnerov
                    // terminal, pa se biljezi njegov TID — obracun provizije
                    // razraduje promet po prodavatelju i inace bi API prodaja
                    // stajala pod crticom.
                    sold_by_username: tid || null,
                    partner_invoice_uuid: null,
                };
                ticketsToCreate.push(ticketRow);
                responseTickets.push({
                    ticket_uuid,
                    ticket_code,
                    order_uuid,
                    order_number: order.order_number,
                    ticket_type_name: item.ticket_type_name,
                    ticket_type_uuid: item.ticket_type_uuid,
                    ticket_single_price: Number(item.single_item_price),
                    ticket_is_active: true,
                    ticket_is_canceled: false,
                    ticket_departure_planed: route.actual_departure,
                    ticket_departure: route.actual_departure,
                    line_code: route.line_code,
                    line_name: route.line_name,
                    ticket_departure_harbor_id: route.departure_harbor_id,
                    ticket_departure_harbor_name: route.departure_harbor_name,
                    ticket_arrival_planed: route.actual_arrival,
                    ticket_arrival: route.actual_arrival,
                    ticket_arrival_harbor_id: route.arrival_harbor_id,
                    ticket_arrival_harbor_name: route.arrival_harbor_name,
                });
            }
        }

        await TicketsModel.bulkCreate(ticketsToCreate);
        await ApiOrdersModel.update(
            { status: "CONFIRMED", confirmed_at: new Date() },
            { where: { order_uuid } }
        );

        return res.status(200).json({
            status: 200,
            data: { tickets: responseTickets },
        });
    } catch (error) {
        console.log("apiConfirmOrderController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { msg: "Internal error" } });
    }
};

const ticketResponseShape = (t) => ({
    ticket_uuid: t.ticket_uuid,
    ticket_code: t.ticket_code,
    order_uuid: t.order_uuid,
    order_number: t.order_number,
    ticket_type_name: t.ticket_type_name,
    ticket_type_uuid: t.ticket_type_uuid,
    ticket_single_price: Number(t.single_price),
    ticket_is_active: !!t.is_active,
    ticket_is_canceled: !!t.is_canceled,
    ticket_departure_planed: t.departure_planed,
    ticket_departure: t.departure,
    line_code: t.line_code,
    line_name: t.line_name,
    ticket_departure_harbor_id: t.departure_harbor_id,
    ticket_departure_harbor_name: t.departure_harbor_name,
    ticket_arrival_planed: t.arrival_planed,
    ticket_arrival: t.arrival,
    ticket_arrival_harbor_id: t.arrival_harbor_id,
    ticket_arrival_harbor_name: t.arrival_harbor_name,
});

const apiCancelOrderController = async (req, res) => {
    const { ApiOrdersModel, TicketsModel } = req.app.locals.models;
    try {
        const { partner_uuid, order_uuid, tickets, trip } = req.body || {};
        if (!order_uuid) return res.status(400).json({ status: 400, data: { msg: "order_uuid required" } });

        const order = await ApiOrdersModel.findOne({ where: { order_uuid } });
        if (!order) return res.status(404).json({ status: 404, data: { msg: "Order not found" } });
        if (partner_uuid && order.partner_uuid !== partner_uuid) {
            return res.status(404).json({ status: 404, data: { msg: "Order not found" } });
        }

        const baseWhere = {
            order_uuid,
            is_active: true,
            is_canceled: false,
            status: { [Op.ne]: "CANCELED" },
        };
        if (Array.isArray(tickets) && tickets.length) {
            baseWhere.ticket_uuid = { [Op.in]: tickets.map((t) => t.ticket_uuid).filter(Boolean) };
        } else if (trip) {
            baseWhere.route_uuid = trip;
        }

        const toCancel = await TicketsModel.findAll({ where: baseWhere });
        if (!toCancel.length) {
            return res.status(400).json({ status: 400, data: { msg: "no tickets to cancel" } });
        }

        const releaseItems = toCancel.map((t) => ({
            route_uuid: t.route_uuid,
            ticket_type_uuid: t.ticket_type_uuid,
            qty: 1,
        }));
        try {
            await releaseBookings(releaseItems);
        } catch (err) {
            console.log("releaseBookings error:", err?.message || err);
        }

        const ticketUuids = toCancel.map((t) => t.ticket_uuid);
        await TicketsModel.update(
            {
                is_active: false,
                is_canceled: true,
                status: "CANCELED",
                deactivate: true,
                deactivate_data: new Date(),
            },
            { where: { ticket_uuid: { [Op.in]: ticketUuids } } }
        );

        const refreshed = await TicketsModel.findAll({ where: { ticket_uuid: { [Op.in]: ticketUuids } } });
        const refundAmount = refreshed.reduce((sum, t) => sum + Number(t.single_price || 0), 0);

        const remainingActive = await TicketsModel.count({
            where: { order_uuid, is_active: true, is_canceled: false },
        });
        if (remainingActive === 0) {
            await ApiOrdersModel.update(
                { status: "CANCELED", canceled_at: new Date() },
                { where: { order_uuid } }
            );
        }

        return res.status(200).json({
            status: 200,
            data: {
                msg: "tickets canceled",
                return_amount: Number(refundAmount.toFixed(2)),
                canceled_tickets: refreshed.map(ticketResponseShape),
            },
        });
    } catch (error) {
        console.log("apiCancelOrderController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { msg: "Internal error" } });
    }
};

const apiTripDetailsController = async (req, res) => {
    try {
        const { trip_uuid } = req.body || {};
        if (!trip_uuid) return res.status(400).json({ status: 400, data: { msg: "trip_uuid required" } });

        const route = await fetchRoute(trip_uuid);
        if (!route) return res.status(404).json({ status: 404, data: { msg: "trip not found" } });

        const stops = route.departure_uuid ? await fetchRoutesByDeparture(route.departure_uuid) : [route];
        const sorted = [...stops].sort(
            (a, b) => parseInt(a.departure_harbor_order, 10) - parseInt(b.departure_harbor_order, 10)
        );
        const trip_details = sorted.map((r) => ({
            departure_harbor_id: r.departure_harbor_id,
            departure_harbor_name: r.departure_harbor_name,
            departure_planed: r.departure || r.actual_departure,
            departure: r.actual_departure || r.departure,
            arrival_harbor_id: r.arrival_harbor_id,
            arrival_harbor_name: r.arrival_harbor_name,
            arrival_planed: r.arrival || r.actual_arrival,
            arrival: r.actual_arrival || r.arrival,
            harbor_order: parseInt(r.departure_harbor_order, 10) || 0,
        }));

        return res.status(200).json({
            status: 200,
            data: { trip_details },
        });
    } catch (error) {
        console.log("apiTripDetailsController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { msg: "Internal error" } });
    }
};

module.exports = {
    apiCreateOrderController,
    apiGetOrderController,
    apiConfirmOrderController,
    apiCancelOrderController,
    apiTripDetailsController,
};
