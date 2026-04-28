const crypto = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");
const { getSequelize } = require("../../config/database");

// Map the legacy boat/voyage base_* capacity field to a category code (lowercase).
const BOAT_CAPACITY_FIELD_BY_CATEGORY = {
    PASSANGER: "base_capacity",
    VIP: "base_vip_capacity",
    PETS: "base_pets_capacity",
    BICYCLE: "base_bicycle_capacity",
};

async function fetchVoyage(departureUuid) {
    const coreConfig = await getCoreServiceConfigData();
    const boatUrl = coreConfig?.services?.boat?.url;
    if (!boatUrl) throw new Error("boat service URL missing in core config");
    // GET all departures and find by uuid — simplest since boat service exposes full list.
    // (Optimize later with a dedicated endpoint if volume grows.)
    try {
        const resp = await axios.get(`${boatUrl}/departures/${departureUuid}`, { timeout: 8000, validateStatus: () => true });
        if (resp.status === 200 && resp.data?.data?.departure) return resp.data.data.departure;
    } catch (_) {}
    // Fallback — scan full list
    const listResp = await axios.get(`${boatUrl}/departures`, { timeout: 8000 });
    const list = listResp.data?.data?.departures || [];
    return list.find((d) => d.uuid === departureUuid) || null;
}

async function fetchRoutesForVoyage(departureUuid) {
    const coreConfig = await getCoreServiceConfigData();
    const boatUrl = coreConfig?.services?.boat?.url;
    const resp = await axios.get(`${boatUrl}/departures/${departureUuid}/routes`, { timeout: 8000 });
    return resp.data?.data?.routes || [];
}

async function initBookingsForVoyage(models, departure_uuid) {
    const { BookingModel, CapacityCategoryModel } = models;
    const existing = await BookingModel.count({ where: { departure_uuid } });
    if (existing > 0) return { inserted: 0, already: true };

    const voyage = await fetchVoyage(departure_uuid);
    if (!voyage) throw new Error(`voyage ${departure_uuid} not found`);

    const allLegs = await fetchRoutesForVoyage(departure_uuid);
    if (!allLegs.length) throw new Error(`no routes for voyage ${departure_uuid}`);
    // Only physical segments. Orders may be non-contiguous (e.g. 10, 20, 30) so build
    // the sorted set of all distinct orders used by the voyage and mark a leg as
    // adjacent when its arrival_order is the immediate successor of its departure_order.
    const uniqueOrders = [...new Set(
        allLegs.flatMap((l) => [Number(l.departure_harbor_order) || 0, Number(l.arrival_harbor_order) || 0])
    )].sort((a, b) => a - b);
    const nextByOrder = new Map();
    for (let i = 0; i < uniqueOrders.length - 1; i++) {
        nextByOrder.set(uniqueOrders[i], uniqueOrders[i + 1]);
    }
    const legs = allLegs.filter((l) => {
        const d = Number(l.departure_harbor_order) || 0;
        const a = Number(l.arrival_harbor_order) || 0;
        return nextByOrder.get(d) === a;
    });
    if (!legs.length) throw new Error(`no adjacent legs for voyage ${departure_uuid}`);

    const categories = await CapacityCategoryModel.findAll({ where: { is_active: true } });
    if (!categories.length) throw new Error("no active capacity categories seeded");

    const rows = [];
    for (const leg of legs) {
        for (const cat of categories) {
            const field = BOAT_CAPACITY_FIELD_BY_CATEGORY[cat.code];
            const baseCap = field ? (parseInt(voyage[field], 10) || 0) : 0;
            rows.push({
                booking_uuid: crypto.randomUUID(),
                departure_uuid,
                timetable_uuid: voyage.timetable_uuid,
                sequence: voyage.sequence,
                departure_date: voyage.departure_date || null,
                boat_uuid: voyage.boat_uuid || null,
                line_code: voyage.line_code || null,
                line_name: voyage.line_name || null,
                route_uuid: leg.uuid,
                departure_harbor_id: leg.departure_harbor_id,
                departure_harbor_name: leg.departure_harbor_name,
                departure_harbor_order: Number(leg.departure_harbor_order) || 0,
                arrival_harbor_id: leg.arrival_harbor_id,
                arrival_harbor_name: leg.arrival_harbor_name,
                arrival_harbor_order: Number(leg.arrival_harbor_order) || 0,
                category_uuid: cat.uuid,
                category_code: cat.code,
                capacity_base: baseCap,
                capacity_additional: 0,
                in_count: 0,
                out_count: 0,
                occupied: 0,
                validated: 0,
                is_active: true,
            });
        }
    }
    await BookingModel.bulkCreate(rows);
    return { inserted: rows.length, already: false };
}

const initBookingsController = async (req, res) => {
    try {
        const data = req.body?.body || req.body || {};
        if (!data.departure_uuid) return res.status(400).send({ status: 400, data: { message: "departure_uuid required" } });
        const result = await initBookingsForVoyage(req.app.locals.models, data.departure_uuid);
        res.send({ status: 200, data: result });
    } catch (error) {
        console.log("initBookingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Get bookings (capacity + occupancy) for a voyage.
// Filter options: departure_uuid (preferred) OR timetable_uuid+sequence+departure_date.
const getBookingsController = async (req, res) => {
    const { BookingModel } = req.app.locals.models;
    try {
        const where = {};
        if (req.query.departure_uuid) where.departure_uuid = req.query.departure_uuid;
        if (req.query.timetable_uuid) where.timetable_uuid = req.query.timetable_uuid;
        if (req.query.sequence) where.sequence = parseInt(req.query.sequence, 10);
        if (req.query.departure_date) where.departure_date = req.query.departure_date;
        if (!Object.keys(where).length) {
            return res.status(400).send({ status: 400, data: { message: "departure_uuid or (timetable_uuid + sequence) required" } });
        }
        const rows = await BookingModel.findAll({
            where,
            order: [["departure_harbor_order", "ASC"], ["category_code", "ASC"]],
        });
        const bookings = rows.map((r) => {
            const capacity_total = r.capacity_base + r.capacity_additional;
            const free = Math.max(0, capacity_total - r.occupied);
            return {
                ...r.toJSON(),
                capacity_total,
                free,
            };
        });
        res.send({ status: 200, data: { bookings } });
    } catch (error) {
        console.log("getBookingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Reserve — body: { items: [{route_uuid, ticket_type_uuid, qty}], departure_uuid? }
// Atomic: for each item, resolve category via ticket_type_mappings, find leg's range
// (departure_harbor_order .. arrival_harbor_order), increment occupied on all legs in range.
// Also: +in_count on leg matching (departure == route's departure_harbor),
//       +out_count on leg matching (arrival == route's arrival_harbor).
// Cache route info (departure_uuid, dep_order, arr_order) fetched from boat-service.
async function fetchRouteMeta(route_uuid) {
    const coreConfig = await getCoreServiceConfigData();
    const boatUrl = coreConfig?.services?.boat?.url;
    if (!boatUrl) throw new Error("boat service URL missing");
    const resp = await axios.get(`${boatUrl}/routes/${route_uuid}`, { timeout: 8000, validateStatus: () => true });
    if (resp.status !== 200) throw new Error(`route ${route_uuid} not found in boat-service`);
    const route = resp.data?.data?.route;
    if (!route) throw new Error(`route ${route_uuid} empty response`);
    return {
        departure_uuid: route.departure_uuid,
        dep_order: Number(route.departure_harbor_order) || 0,
        arr_order: Number(route.arrival_harbor_order) || 0,
    };
}

async function ensureVoyageInitForRoute(models, route_uuid) {
    const { BookingModel } = models;
    const existing = await BookingModel.count({ where: { departure_uuid: null } });
    // Existence check by departure_uuid — but we don't have it. Instead look up route meta first.
    const meta = await fetchRouteMeta(route_uuid);
    const hasBookings = await BookingModel.count({ where: { departure_uuid: meta.departure_uuid } });
    if (hasBookings === 0) await initBookingsForVoyage(models, meta.departure_uuid);
    return meta;
}

async function performReserve({ models, items, sign }) {
    const { BookingModel, TicketTypeMappingModel } = models;
    const sequelize = getSequelize();

    // Resolve route metadata once (also triggers voyage init if needed)
    const routeMetaByUuid = new Map();
    for (const r of [...new Set(items.map((i) => i.route_uuid).filter(Boolean))]) {
        routeMetaByUuid.set(r, await ensureVoyageInitForRoute(models, r));
    }

    // Resolve mappings once
    const ttUuids = [...new Set(items.map((i) => i.ticket_type_uuid).filter(Boolean))];
    const mappings = await TicketTypeMappingModel.findAll({
        where: { ticket_type_uuid: { [Op.in]: ttUuids } },
    });
    const mapByTt = new Map(mappings.map((m) => [m.ticket_type_uuid, m]));

    const affected = [];
    await sequelize.transaction(async (t) => {
        for (const it of items) {
            const qty = parseInt(it.qty, 10) || 0;
            if (!qty) continue;
            const mapping = mapByTt.get(it.ticket_type_uuid);
            if (!mapping) throw new Error(`no category mapping for ticket_type ${it.ticket_type_uuid}`);
            const meta = routeMetaByUuid.get(it.route_uuid);
            if (!meta) throw new Error(`no route metadata for ${it.route_uuid}`);

            // Lock and fetch all adjacent physical legs that overlap with [meta.dep_order, meta.arr_order].
            // Since we only init ADJACENT legs, this naturally filters to physical segments.
            const locked = await BookingModel.findAll({
                where: {
                    departure_uuid: meta.departure_uuid,
                    category_uuid: mapping.category_uuid,
                    departure_harbor_order: { [Op.gte]: meta.dep_order },
                    arrival_harbor_order: { [Op.lte]: meta.arr_order },
                },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!locked.length) throw new Error(`no physical legs in range ${meta.dep_order}..${meta.arr_order} for route ${it.route_uuid}`);

            // Overbooking check (only on reserve, i.e. sign=+1)
            if (sign > 0) {
                for (const row of locked) {
                    const total = Number(row.capacity_base) + Number(row.capacity_additional);
                    const free = total - Number(row.occupied);
                    if (free < qty) {
                        throw new Error(
                            `Nema dovoljno slobodnog kapaciteta (${mapping.category_code}) na etapi ` +
                            `${row.departure_harbor_name} → ${row.arrival_harbor_name}: ` +
                            `slobodno ${free}, traženo ${qty}`
                        );
                    }
                }
            }

            // Increment occupied on all physical segments in range
            const ids = locked.map((r) => r.id);
            await BookingModel.increment(
                { occupied: sign * qty },
                { where: { id: { [Op.in]: ids } }, transaction: t }
            );
            // in_count on the boarding leg (dep_order == meta.dep_order)
            const boarding = locked.find((r) => r.departure_harbor_order === meta.dep_order);
            if (boarding) {
                await BookingModel.increment(
                    { in_count: sign * qty },
                    { where: { id: boarding.id }, transaction: t }
                );
            }
            // out_count on the disembarking leg (arr_order == meta.arr_order)
            const disembarking = locked.find((r) => r.arrival_harbor_order === meta.arr_order);
            if (disembarking) {
                await BookingModel.increment(
                    { out_count: sign * qty },
                    { where: { id: disembarking.id }, transaction: t }
                );
            }

            affected.push({
                route_uuid: it.route_uuid,
                category: mapping.category_code,
                qty: sign * qty,
                legs_updated: locked.length,
            });
        }
    });
    return affected;
}

const reserveBookingsController = async (req, res) => {
    try {
        const data = req.body?.body || req.body || {};
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) return res.status(400).send({ status: 400, data: { message: "items required" } });
        const affected = await performReserve({ models: req.app.locals.models, items, sign: +1 });
        res.send({ status: 200, data: { affected } });
    } catch (error) {
        console.log("reserveBookingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const releaseBookingsController = async (req, res) => {
    try {
        const data = req.body?.body || req.body || {};
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) return res.status(400).send({ status: 400, data: { message: "items required" } });
        const affected = await performReserve({ models: req.app.locals.models, items, sign: -1 });
        res.send({ status: 200, data: { affected } });
    } catch (error) {
        console.log("releaseBookingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Set additional capacity (dispatcher override). Updates ALL legs of the voyage for given category.
// Body: { departure_uuid, category_uuid, additional }
const setAdditionalCapacityController = async (req, res) => {
    const { BookingModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const { departure_uuid, category_uuid } = data;
        const additional = Math.max(0, parseInt(data.additional, 10) || 0);
        if (!departure_uuid || !category_uuid) {
            return res.status(400).send({ status: 400, data: { message: "departure_uuid and category_uuid required" } });
        }
        const [affected] = await BookingModel.update(
            { capacity_additional: additional },
            { where: { departure_uuid, category_uuid } }
        );
        res.send({ status: 200, data: { affected } });
    } catch (error) {
        console.log("setAdditionalCapacityController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Validate — body: { route_uuid, category_uuid, qty }  (boat desk QR scan)
const validateTicketsController = async (req, res) => {
    const { BookingModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const { route_uuid, category_uuid } = data;
        const qty = parseInt(data.qty, 10) || 1;
        if (!route_uuid || !category_uuid) {
            return res.status(400).send({ status: 400, data: { message: "route_uuid and category_uuid required" } });
        }
        await BookingModel.increment(
            { validated: qty },
            { where: { route_uuid, category_uuid } }
        );
        res.send({ status: 200 });
    } catch (error) {
        console.log("validateTicketsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    initBookingsController,
    getBookingsController,
    reserveBookingsController,
    releaseBookingsController,
    setAdditionalCapacityController,
    validateTicketsController,
};
