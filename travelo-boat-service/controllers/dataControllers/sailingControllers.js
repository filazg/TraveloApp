const { Op } = require("sequelize");

// Routes.departure_date is stored as "DD/MM/YYYY". Accept either format on input.
const normalizeDateToDmy = (s) => {
    if (!s) return "";
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return String(s);
};

// Allowed leg status transitions (sailing-items level).
// CREATED is the default state for new routes; CANCELED is terminal.
const ALLOWED_STATUSES = ["CREATED", "PREPARED", "WAITING", "BOARDING", "DEPARTED", "ARIVED", "CANCELED"];

// Derive sailing-level status from the leg statuses. Used only for list UI.
//   - all CANCELED → "CANCELED"
//   - all pre-sailing (CREATED/PREPARED/WAITING) or CANCELED → "CREATED" (not yet started)
//   - all ARIVED or CANCELED → "ARIVED" (voyage complete)
//   - any BOARDING/DEPARTED mixed with pre-sailing or ARIVED → "IN_PROGRESS"
const PRE_SAILING_STATUSES = new Set(["CREATED", "PREPARED", "WAITING", "CANCELED"]);
// Accepts leg objects {status, arrival_canceled} or plain status strings.
const deriveSailingStatus = (legs) => {
    const norm = legs.map((l) => {
        if (l && typeof l === "object") {
            if (l.arrival_canceled) return "CANCELED";
            return l.status ? String(l.status).toUpperCase() : "CREATED";
        }
        return l ? String(l).toUpperCase() : "CREATED";
    });
    if (!norm.length) return "CREATED";
    if (norm.every((s) => s === "CANCELED")) return "CANCELED";
    if (norm.every((s) => PRE_SAILING_STATUSES.has(s))) return "CREATED";
    if (norm.every((s) => s === "ARIVED" || s === "CANCELED")) return "ARIVED";
    return "IN_PROGRESS";
};

const getSailingsController = async (req, res) => {
    const { RoutesModel, DeparturesModel } = req.app.locals.models;
    try {
        const { line_uuid, departure_date, include } = req.query || {};
        if (!departure_date) {
            return res.status(400).send({ status: 400, data: { message: "departure_date required" } });
        }
        const includeLegs = String(include || "").includes("legs");
        const dmy = normalizeDateToDmy(departure_date);
        // Otkaz polaska gasi `is_active`, čime polazak prestaje ići u prodaju.
        // Dispečer ga ipak mora vidjeti — treba znati što je otkazano, provjeriti
        // karte i po potrebi vratiti polazak u prodaju. Zato ovdje uz aktivne
        // ulaze i oni otkazani.
        const where = {
            departure_date: dmy,
            [Op.or]: [{ is_active: true }, { sale_status: "CANCELED" }],
        };
        if (line_uuid) where.line_uuid = line_uuid;

        const routes = await RoutesModel.findAll({
            where,
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["departure_harbor_order", "ASC"]],
        });

        // Group by VOYAGE (one row per voyage), ne po legu. Sequence je pravi
        // ključ — sve etape istog voyage-a dijele isti (timetable_uuid +
        // sequence + departure_date). voyage_id u Excelu je per-leg pa se
        // NE koristi za grupiranje.
        const voyageKey = (r) =>
            `t:${r.timetable_uuid}|s:${r.sequence}|d:${r.departure_date}`;

        const groups = new Map();
        for (const r of routes) {
            const key = voyageKey(r);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(r);
        }

        // Sve leg-level departure_uuid-eve trebaju za fetch DeparturesModel-a
        // (origin) i kasnije za bookings agregaciju u portal sloju.
        const allDepUuids = [...new Set(routes.map((r) => r.departure_uuid).filter(Boolean))];
        const departures = allDepUuids.length
            ? await DeparturesModel.findAll({
                  where: { uuid: { [Op.in]: allDepUuids } },
                  attributes: { exclude: ["createdAt", "updatedAt"] },
              })
            : [];
        const depByUuid = new Map(departures.map((d) => [d.uuid, d.toJSON ? d.toJSON() : d]));

        const sailings = [];
        for (const [, legsAll] of groups.entries()) {
            // Adjacent physical legs only (arrival_order - departure_order === 10) — actual stops.
            const adjacent = legsAll
                .filter((l) => Number(l.arrival_harbor_order) - Number(l.departure_harbor_order) === 10)
                .sort((a, b) => Number(a.departure_harbor_order) - Number(b.departure_harbor_order));
            if (!adjacent.length) continue;

            // Origin = prvi leg, njegov departure_uuid je identitet voyage-a.
            const originDepUuid = adjacent[0].departure_uuid;
            const originDep = depByUuid.get(originDepUuid);
            if (!originDep) continue;

            const legDepUuids = [...new Set(adjacent.map((l) => l.departure_uuid).filter(Boolean))];
            const legStatuses = adjacent.map((l) => l.status);

            const row = {
                ...originDep,
                uuid: originDepUuid,
                sailing_status: deriveSailingStatus(adjacent),
                // Prodajni status polaska. Odvojen je od `sailing_status`, koji
                // prati plovidbu (kreiran / isplovio / uplovio). Bez ovoga
                // dispečer nije imao po čemu vidjeti da je polazak otkazan —
                // otkaz upisuje sale_status, a prikaz je gledao sailing_status.
                // Dovoljan je jedan otkazani leg: putovanje kao cjelina ne vozi.
                sale_status: adjacent.some((l) => l.sale_status === "CANCELED") ? "CANCELED" : null,
                // Rute otkazanog polaska trebaju za vraćanje u prodaju.
                all_route_uuids: legsAll.map((l) => l.uuid),
                legs_total: adjacent.length,
                legs_canceled: legStatuses.filter((s) => s === "CANCELED").length,
                first_departure_time: adjacent[0]?.departure_time || originDep.departure_planed || "",
                // Portal-sloj koristi ovo da fetcha bookings za svaki leg pa
                // agregira po voyage-u.
                leg_departure_uuids: legDepUuids,
            };

            if (includeLegs) {
                row.legs = adjacent.map((l) => (l.toJSON ? l.toJSON() : l));
                // All routes (uključujući compound) — caller može trebati za otkaz karata.
                row.all_route_uuids = legsAll.map((l) => l.uuid);
            }
            sailings.push(row);
        }

        sailings.sort((a, b) => (a.first_departure_time || "").localeCompare(b.first_departure_time || ""));

        return res.send({ status: 200, data: { sailings } });
    } catch (error) {
        console.log("getSailingsController error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const getSailingDetailsController = async (req, res) => {
    const { RoutesModel, DeparturesModel } = req.app.locals.models;
    try {
        const { uuid } = req.params;
        const first = await DeparturesModel.findOne({
            where: { uuid },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        });
        if (!first) return res.status(404).send({ status: 404, data: { message: "sailing not found" } });

        // Fetch all physical legs (Departures) for this voyage. Sequence je
        // pravi ključ — voyage_id u Excel-flow-u je per-leg pa ne identificira
        // voyage. Group: timetable_uuid + sequence + departure_date.
        // departure_planed format je "DD.MM.YYYY.HH:mm" pa filter po prefiksu
        // datuma da uhvati sve etape istog dana.
        const dotPrefix = (first.departure_planed || "").split(".").slice(0, 3).join(".") + ".";
        const physicalLegs = await DeparturesModel.findAll({
            where: {
                timetable_uuid: first.timetable_uuid,
                sequence: first.sequence,
                departure_planed: { [Op.like]: `${dotPrefix}%` },
                is_active: true,
            },
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["harbor_order", "ASC"]],
        });

        // Harbor sequence: first leg's departure harbor + each subsequent leg's arrival harbor.
        const harbors = [];
        physicalLegs.forEach((leg, idx) => {
            if (idx === 0) {
                harbors.push({
                    order: leg.harbor_order,
                    harbor_id: leg.departure_harbor_id,
                    harbor_name: leg.departure_harbor_name,
                    planned_departure: leg.departure_planed,
                    planned_arrival: null,
                    actual_departure: leg.departure,
                    actual_arrival: null,
                    is_first: true,
                    is_last: false,
                });
            }
            harbors.push({
                order: leg.harbor_order + 10,
                harbor_id: leg.arrival_harbor_id,
                harbor_name: leg.arrival_harbor_name,
                planned_departure: null,
                planned_arrival: leg.arrival_planed,
                actual_departure: null,
                actual_arrival: leg.arrival,
                is_first: false,
                is_last: idx === physicalLegs.length - 1,
            });
        });
        // Merge consecutive entries for the same harbor (middle stops have both planned arrival from previous leg AND planned departure from next leg).
        for (let i = 1; i < physicalLegs.length; i++) {
            const nextLeg = physicalLegs[i];
            const harborIdx = harbors.findIndex((h) => h.harbor_id === nextLeg.departure_harbor_id && h.order === nextLeg.harbor_order);
            if (harborIdx >= 0) {
                harbors[harborIdx].planned_departure = nextLeg.departure_planed;
                harbors[harborIdx].actual_departure = nextLeg.departure;
            }
        }

        // Adjacent Routes (one per physical leg) — source of truth za leg
        // status + cancel akcije. Sequence + datum su ključevi voyage-a;
        // voyage_id je per-leg u Excel-flow-u pa ga NE koristimo.
        const depDateRaw = (first.departure_planed || "").split(".").slice(0, 3).join("/"); // "DD/MM/YYYY"
        const adjacentLegs = await RoutesModel.findAll({
            where: {
                timetable_uuid: first.timetable_uuid,
                sequence: first.sequence,
                departure_date: depDateRaw,
                // Kao i u popisu polazaka: otkazani ostaju vidljivi dispečeru,
                // inače bi detalji otkazanog polaska došli bez ijedne etape.
                [Op.or]: [{ is_active: true }, { sale_status: "CANCELED" }],
            },
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["departure_harbor_order", "ASC"]],
        });
        const legs = adjacentLegs.filter((r) => Number(r.arrival_harbor_order) - Number(r.departure_harbor_order) === 10);

        return res.send({
            status: 200,
            data: {
                sailing: {
                    ...(first.toJSON ? first.toJSON() : first),
                    sailing_status: deriveSailingStatus(legs),
                },
                harbors,
                legs,
                physical_legs: physicalLegs,
            },
        });
    } catch (error) {
        console.log("getSailingDetailsController error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const startSailingController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const { departure_uuid } = req.body?.body || req.body || {};
        if (!departure_uuid) {
            return res.status(400).send({ status: 400, data: { message: "departure_uuid required" } });
        }
        // Transition all non-canceled legs from CREATED/null → PREPARED.
        const [affected] = await RoutesModel.update(
            { status: "PREPARED" },
            {
                where: {
                    departure_uuid,
                    is_active: true,
                    [Op.or]: [{ status: null }, { status: "" }, { status: "CREATED" }],
                },
            }
        );
        return res.send({ status: 200, data: { message: "sailing started", legs_updated: affected } });
    } catch (error) {
        console.log("startSailingController error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const updateLegStatusController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const body = req.body?.body || req.body || {};
        const { route_uuid, status, delay_minutes, note } = body;
        if (!route_uuid) return res.status(400).send({ status: 400, data: { message: "route_uuid required" } });
        const nextStatus = String(status || "").toUpperCase();
        if (!ALLOWED_STATUSES.includes(nextStatus)) {
            return res.status(400).send({
                status: 400,
                data: { message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
            });
        }

        const row = await RoutesModel.findOne({ where: { uuid: route_uuid } });
        if (!row) return res.status(404).send({ status: 404, data: { message: "route not found" } });

        const patch = { status: nextStatus };
        const nowIso = new Date().toISOString();
        const delayInt = Number.isFinite(parseInt(delay_minutes, 10)) ? parseInt(delay_minutes, 10) : null;
        const noteTrim = typeof note === "string" ? note.trim() || null : null;

        if (nextStatus === "DEPARTED") {
            if (!row.actual_departure) patch.actual_departure = nowIso;
            if (delayInt !== null) patch.departure_delay_minutes = delayInt;
            if (noteTrim !== null) patch.departure_note = noteTrim;
        }
        if (nextStatus === "ARIVED") {
            if (!row.actual_arrival) patch.actual_arrival = nowIso;
            if (delayInt !== null) patch.arrival_delay_minutes = delayInt;
            if (noteTrim !== null) patch.arrival_note = noteTrim;
        }

        await row.update(patch);
        return res.send({ status: 200, data: { message: "leg updated", route: row } });
    } catch (error) {
        console.log("updateLegStatusController error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Mark arrival at a harbor as canceled. The incoming leg gets arrival_canceled=true.
// Returns the list of compound route_uuids that touch this harbor (start or end) so the
// caller can also cancel associated tickets via transactions service.
const cancelHarborArrivalController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const { route_uuid, cancel_reason } = req.body?.body || req.body || {};
        if (!route_uuid) return res.status(400).send({ status: 400, data: { message: "route_uuid required" } });

        const incoming = await RoutesModel.findOne({ where: { uuid: route_uuid } });
        if (!incoming) return res.status(404).send({ status: 404, data: { message: "route not found" } });

        const harborId = incoming.arrival_harbor_id;
        const voyageId = incoming.voyage_id;

        const patch = { arrival_canceled: true };
        const note = typeof cancel_reason === "string" ? cancel_reason.trim() : "";
        if (note) patch.arrival_note = note;
        await incoming.update(patch);

        // Collect all compound routes of this voyage that touch the canceled harbor (as dep or arr).
        // These are the tickets that need to be refunded.
        const touching = await RoutesModel.findAll({
            where: {
                voyage_id: voyageId,
                is_active: true,
                [Op.or]: [
                    { departure_harbor_id: harborId },
                    { arrival_harbor_id: harborId },
                ],
            },
            attributes: ["uuid"],
        });

        return res.send({
            status: 200,
            data: {
                canceled_harbor_id: harborId,
                incoming_leg_uuid: route_uuid,
                affected_route_uuids: touching.map((r) => r.uuid),
            },
        });
    } catch (error) {
        console.log("cancelHarborArrivalController error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Zamjena plovila na jednom polasku (voyage-u), ne na cijelom plovidbenom redu.
// Voyage = svi legovi koji dijele (timetable_uuid + sequence + departure_date),
// isti ključ kojim getSailingsController grupira retke. Uz plovilo se prepisuju
// i bazni kapaciteti, jer se oni vode po polasku.
const changeBoatController = async (req, res) => {
    const { RoutesModel, DeparturesModel, BoatsModel } = req.app.locals.models;
    try {
        const body = req.body?.body || req.body || {};
        const departureUuid = body.departure_uuid;
        const boatUuid = body.boat_uuid;
        if (!departureUuid || !boatUuid) {
            return res.status(400).send({
                status: 400,
                data: { message: "departure_uuid i boat_uuid su obavezni" },
            });
        }

        const boat = await BoatsModel.findOne({ where: { uuid: boatUuid } });
        if (!boat) {
            return res.status(404).send({ status: 404, data: { message: "plovilo nije pronađeno" } });
        }

        // Bilo koji leg voyage-a je dovoljan da se dođe do ključa voyage-a.
        const anyLeg = await RoutesModel.findOne({
            where: { departure_uuid: departureUuid, is_active: true },
        });
        if (!anyLeg) {
            return res.status(404).send({ status: 404, data: { message: "polazak nije pronađen" } });
        }

        const voyageLegs = await RoutesModel.findAll({
            where: {
                timetable_uuid: anyLeg.timetable_uuid,
                sequence: anyLeg.sequence,
                departure_date: anyLeg.departure_date,
                is_active: true,
            },
            order: [["departure_harbor_order", "ASC"]],
        });
        const depUuids = [...new Set(voyageLegs.map((l) => l.departure_uuid).filter(Boolean))];
        if (!depUuids.length) {
            return res.status(404).send({ status: 404, data: { message: "voyage nema polazaka" } });
        }

        const capacities = {
            base_capacity: Number(boat.capacity) || 0,
            base_vip_capacity: Number(boat.vip_capacity) || 0,
            base_pets_capacity: Number(boat.pets_capacity) || 0,
            base_bicycle_capacity: Number(boat.bicycle_capacity) || 0,
        };

        const [affected] = await DeparturesModel.update(
            { boat_uuid: boatUuid, ...capacities },
            { where: { uuid: { [Op.in]: depUuids } } }
        );

        return res.send({
            status: 200,
            data: {
                departures_updated: affected,
                canonical_departure_uuid: voyageLegs[0].departure_uuid,
                leg_departure_uuids: depUuids,
                boat_uuid: boatUuid,
                boat_name: boat.name,
                capacities,
            },
        });
    } catch (error) {
        console.log("changeBoatController error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    getSailingsController,
    getSailingDetailsController,
    startSailingController,
    updateLegStatusController,
    cancelHarborArrivalController,
    changeBoatController,
};
