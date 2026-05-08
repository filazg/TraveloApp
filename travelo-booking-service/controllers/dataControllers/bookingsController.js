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

// Resolve VOYAGE info for any of its legs. Vraća sve adjacent legove (route-ove
// s order diff = 10) i kanonski departure_uuid voyage-a (= prvi leg). Bookings
// se drže pod kanonskim uuid-em pa se cijeli voyage broji kao jedna jedinica.
async function fetchVoyageInfo(anyLegDepartureUuid) {
    const coreConfig = await getCoreServiceConfigData();
    const boatUrl = coreConfig?.services?.boat?.url;
    const resp = await axios.get(`${boatUrl}/sailings/${anyLegDepartureUuid}`, {
        timeout: 8000,
        validateStatus: () => true,
    });
    if (resp.status !== 200) {
        throw new Error(`sailing not found for leg ${anyLegDepartureUuid}: HTTP ${resp.status}`);
    }
    const data = resp.data?.data || {};
    const legs = Array.isArray(data.legs) ? data.legs : [];
    if (!legs.length) throw new Error(`no adjacent legs for voyage ${anyLegDepartureUuid}`);
    const sortedLegs = [...legs].sort(
        (a, b) => Number(a.departure_harbor_order) - Number(b.departure_harbor_order)
    );
    const canonicalUuid = sortedLegs[0]?.departure_uuid;
    if (!canonicalUuid) throw new Error(`canonical voyage uuid not found for ${anyLegDepartureUuid}`);
    return {
        canonicalUuid,
        legs: sortedLegs,
        sailing: data.sailing || null,
    };
}

async function initBookingsForVoyage(models, anyLegUuid) {
    const { BookingModel, CapacityCategoryModel } = models;

    // Sve booking row-ove voyage-a držimo pod kanonskim departure_uuid-om
    // (= prvi leg voyage-a). Idempotent: ako rows pod kanonskim uuid-em već
    // postoje, skip.
    const { canonicalUuid, legs } = await fetchVoyageInfo(anyLegUuid);
    const existing = await BookingModel.count({ where: { departure_uuid: canonicalUuid } });
    if (existing > 0) return { inserted: 0, already: true, canonical_uuid: canonicalUuid };

    const voyage = await fetchVoyage(canonicalUuid);
    if (!voyage) throw new Error(`voyage ${canonicalUuid} not found`);

    const categories = await CapacityCategoryModel.findAll({ where: { is_active: true } });
    if (!categories.length) throw new Error("no active capacity categories seeded");

    const rows = [];
    for (const leg of legs) {
        for (const cat of categories) {
            const field = BOAT_CAPACITY_FIELD_BY_CATEGORY[cat.code];
            const baseCap = field ? (parseInt(voyage[field], 10) || 0) : 0;
            rows.push({
                booking_uuid: crypto.randomUUID(),
                departure_uuid: canonicalUuid,
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
    return { inserted: rows.length, already: false, canonical_uuid: canonicalUuid };
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
// Filter options: departure_uuid (preferred — normalizira se na kanonski uuid
// voyage-a) OR timetable_uuid+sequence+departure_date.
const getBookingsController = async (req, res) => {
    const { BookingModel } = req.app.locals.models;
    try {
        const where = {};
        if (req.query.departure_uuid) {
            // Normaliziraj na kanonski voyage uuid (= prvi leg). Bez ovoga, ako
            // se pita za neki ne-prvi leg, ne bi se vratili row-ovi voyage-a.
            try {
                const { canonicalUuid } = await fetchVoyageInfo(req.query.departure_uuid);
                where.departure_uuid = canonicalUuid;
            } catch (_) {
                where.departure_uuid = req.query.departure_uuid;
            }
        }
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
    // Normaliziraj na kanonski voyage uuid (= prvi leg). Bookings se drže pod
    // tim uuid-em pa cijeli voyage broji kao jedna jedinica.
    const { canonicalUuid } = await fetchVoyageInfo(route.departure_uuid);
    return {
        departure_uuid: canonicalUuid,
        dep_order: Number(route.departure_harbor_order) || 0,
        arr_order: Number(route.arrival_harbor_order) || 0,
    };
}

async function ensureVoyageInitForRoute(models, route_uuid) {
    const { BookingModel } = models;
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
