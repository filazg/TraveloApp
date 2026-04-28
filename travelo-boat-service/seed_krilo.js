// Seed Krilo.hr timetables + departures + routes into the system.
//
// Usage:
//   node seed_krilo.js                         -> default: next 7 days, Split-Dubrovnik only
//   node seed_krilo.js --from=2026-04-01 --to=2026-10-31 --route=SD
//   node seed_krilo.js --all                   -> all routes defined below
//   node seed_krilo.js --dry-run               -> don't write, just log
//
const crypto = require("crypto");
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");
const { initModels } = require("./dbModels");

// ---- CONFIG: Krilo harbor codes (as found in DB) ----
const H = {
    SPLIT: { code: "HR458", name: "Split" },
    MILNA: { code: "HR391", name: "Milna" },
    HVAR: { code: "HR546", name: "Hvar" },
    KORCULA: { code: "HR491", name: "Korčula" },
    POMENA: { code: "HR543", name: "Pomena" },
    DUBROVNIK: { code: "Hr667", name: "Dubrovnik" },
    SUPETAR: { code: "HR367", name: "Supetar" },
    BOL: { code: "HR555", name: "Bol" },
    VIS: { code: "HR4466", name: "Vis" },
};

// Route definitions: forward stops with cumulative times (HH:MM).
// For each route we generate a daily forward + reverse sailing.
const ROUTES = {
    SD: {
        line_code: "KRILO-SD",
        line_name: "Krilo: Split - Dubrovnik",
        timetable_code: "KRILO-SD-MAIN",
        timetable_name: "Split - Dubrovnik (ljetna)",
        forward: {
            dep_time: "08:00",
            stops: [
                { h: H.SPLIT, arr: null, dep: "08:00" },
                { h: H.MILNA, arr: "08:25", dep: "08:30" },
                { h: H.HVAR, arr: "09:00", dep: "09:10" },
                { h: H.KORCULA, arr: "10:20", dep: "10:30" },
                { h: H.POMENA, arr: "11:05", dep: "11:10" },
                { h: H.DUBROVNIK, arr: "12:30", dep: null },
            ],
        },
        reverse: {
            dep_time: "15:30",
            stops: [
                { h: H.DUBROVNIK, arr: null, dep: "15:30" },
                { h: H.POMENA, arr: "16:50", dep: "16:55" },
                { h: H.KORCULA, arr: "17:30", dep: "17:40" },
                { h: H.HVAR, arr: "18:50", dep: "19:00" },
                { h: H.MILNA, arr: "19:30", dep: "19:35" },
                { h: H.SPLIT, arr: "20:00", dep: null },
            ],
        },
    },
    SS: {
        line_code: "KRILO-SS",
        line_name: "Krilo: Split - Supetar",
        timetable_code: "KRILO-SS-MAIN",
        timetable_name: "Split - Supetar (cjelogodišnja)",
        // Split-Supetar has multiple daily departures — seed the summer (7/day) variant.
        multiDaily: {
            forward_times: [
                { dep: "06:25", arr: "07:00" },
                { dep: "08:00", arr: "09:00" },
                { dep: "10:00", arr: "11:00" },
                { dep: "12:00", arr: "13:00" },
                { dep: "14:00", arr: "15:00" },
                { dep: "16:00", arr: "17:00" },
                { dep: "18:00", arr: "19:00" },
            ],
            reverse_times: [
                { dep: "07:15", arr: "07:50" },
                { dep: "09:15", arr: "10:00" },
                { dep: "11:15", arr: "12:00" },
                { dep: "13:15", arr: "14:00" },
                { dep: "15:15", arr: "16:00" },
                { dep: "17:15", arr: "18:00" },
                { dep: "19:15", arr: "20:00" },
            ],
            from: H.SPLIT,
            to: H.SUPETAR,
        },
    },
    SH: {
        line_code: "KRILO-SH",
        line_name: "Krilo: Split - Hvar",
        timetable_code: "KRILO-SH-MAIN",
        timetable_name: "Split - Hvar (sezonska)",
        multiDaily: {
            forward_times: [
                { dep: "09:00", arr: "10:15" },
                { dep: "10:00", arr: "11:15" },
                { dep: "11:00", arr: "12:15" },
                { dep: "12:00", arr: "13:15" },
                { dep: "15:30", arr: "16:45" },
                { dep: "18:00", arr: "19:15" },
            ],
            reverse_times: [
                { dep: "07:00", arr: "08:15" },
                { dep: "11:30", arr: "12:45" },
                { dep: "13:45", arr: "15:00" },
                { dep: "14:30", arr: "15:45" },
                { dep: "17:15", arr: "18:30" },
                { dep: "19:45", arr: "21:00" },
            ],
            from: H.SPLIT,
            to: H.HVAR,
        },
    },
    SB: {
        line_code: "KRILO-SB",
        line_name: "Krilo: Split - Bol",
        timetable_code: "KRILO-SB-MAIN",
        timetable_name: "Split - Bol",
        multiDaily: {
            forward_times: [
                { dep: "08:30", arr: "09:40" },
                { dep: "16:00", arr: "17:10" },
            ],
            reverse_times: [
                { dep: "09:45", arr: "10:55" },
                { dep: "17:15", arr: "18:25" },
            ],
            from: H.SPLIT,
            to: H.BOL,
        },
    },
};

// ---- HELPERS ----
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtRouteDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtPlanedAt = (d, hhmm) => `${fmtDate(d)}.${hhmm}`;
const addMinutes = (hhmm, minutes) => {
    const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
    const total = h * 60 + m + minutes;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${pad(hh)}:${pad(mm)}`;
};

const parseArgs = () => {
    const args = { route: null, from: null, to: null, all: false, dry: false };
    process.argv.slice(2).forEach((a) => {
        if (a === "--all") args.all = true;
        else if (a === "--dry-run") args.dry = true;
        else if (a.startsWith("--route=")) args.route = a.split("=")[1];
        else if (a.startsWith("--from=")) args.from = new Date(a.split("=")[1]);
        else if (a.startsWith("--to=")) args.to = new Date(a.split("=")[1]);
    });
    if (!args.from) {
        args.from = new Date();
        args.from.setHours(0, 0, 0, 0);
    }
    if (!args.to) {
        args.to = new Date(args.from);
        args.to.setDate(args.to.getDate() + 6); // default: +7 days window
    }
    if (!args.route && !args.all) args.route = "SD";
    return args;
};

// Build per-leg departure rows for a single voyage (one direction).
// Returns array of leg rows + last-stop marker. harbor_order uses 10,20,30,... steps.
const legsFromStops = (stops) => {
    const legs = [];
    for (let i = 0; i < stops.length - 1; i++) {
        const from = stops[i];
        const to = stops[i + 1];
        legs.push({
            harbor_order: (i + 1) * 10,
            dep_harbor: from.h,
            arr_harbor: to.h,
            dep_time: from.dep,
            arr_time: to.arr,
        });
    }
    return legs;
};

// ---- MAIN ----
(async () => {
    const args = parseArgs();
    console.log("Seed Krilo — from:", args.from.toISOString().slice(0, 10), "to:", args.to.toISOString().slice(0, 10), "route:", args.route || "ALL", "dry:", args.dry);

    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const sequelize = getSequelize();
    const models = initModels();
    const { LinesModel, TimetablesModel, DeparturesModel, RoutesModel, BoatsModel } = models;

    const boats = await BoatsModel.findAll();
    const defaultBoat = boats[0] || null;
    if (!defaultBoat) console.warn("⚠ No boats found — capacities will be null");

    const routeKeys = args.all ? Object.keys(ROUTES) : [args.route];

    // Sequence counter — unique across entire seed run per timetable
    // (keeps route generator happy since it groups by sequence).
    const seqByTt = new Map();
    const nextSeq = (ttUuid) => {
        const n = (seqByTt.get(ttUuid) || 0) + 1;
        seqByTt.set(ttUuid, n);
        return n;
    };

    for (const key of routeKeys) {
        const rd = ROUTES[key];
        if (!rd) { console.warn("Unknown route:", key); continue; }

        // 1. LINE
        let line = await LinesModel.findOne({ where: { code: rd.line_code } });
        if (!line) {
            console.log(`  + create line ${rd.line_code}`);
            if (!args.dry) {
                line = await LinesModel.create({
                    uuid: crypto.randomUUID(),
                    code: rd.line_code,
                    name: rd.line_name,
                    type: "BOAT",
                    first_harbor_id: rd.forward?.stops?.[0]?.h.code || rd.multiDaily?.from.code,
                    first_harbor_name: rd.forward?.stops?.[0]?.h.name || rd.multiDaily?.from.name,
                    last_harbor_id: rd.forward?.stops?.slice(-1)[0]?.h.code || rd.multiDaily?.to.code,
                    last_harbor_name: rd.forward?.stops?.slice(-1)[0]?.h.name || rd.multiDaily?.to.name,
                    is_active: true,
                });
            }
        } else {
            console.log(`  · line exists ${rd.line_code}`);
        }

        // 2. TIMETABLE
        let timetable = await TimetablesModel.findOne({ where: { code: rd.timetable_code } });
        if (!timetable) {
            console.log(`  + create timetable ${rd.timetable_code}`);
            if (!args.dry) {
                timetable = await TimetablesModel.create({
                    uuid: crypto.randomUUID(),
                    code: rd.timetable_code,
                    name: rd.timetable_name,
                    line_uuid: line?.uuid || "",
                    line_code: rd.line_code,
                    line_name: rd.line_name,
                    is_active: true,
                });
            }
        } else {
            console.log(`  · timetable exists ${rd.timetable_code}`);
        }
        if (args.dry) continue;

        // 3. DEPARTURES + ROUTES for each date in range
        for (let d = new Date(args.from); d <= args.to; d.setDate(d.getDate() + 1)) {
            const dateCopy = new Date(d);

            const voyages = [];
            if (rd.forward && rd.reverse) {
                voyages.push({ direction: "A→B", legs: legsFromStops(rd.forward.stops) });
                voyages.push({ direction: "B→A", legs: legsFromStops(rd.reverse.stops) });
            } else if (rd.multiDaily) {
                for (const t of rd.multiDaily.forward_times) {
                    voyages.push({
                        direction: "A→B",
                        legs: [{ harbor_order: 10, dep_harbor: rd.multiDaily.from, arr_harbor: rd.multiDaily.to, dep_time: t.dep, arr_time: t.arr }],
                    });
                }
                for (const t of rd.multiDaily.reverse_times) {
                    voyages.push({
                        direction: "B→A",
                        legs: [{ harbor_order: 10, dep_harbor: rd.multiDaily.to, arr_harbor: rd.multiDaily.from, dep_time: t.dep, arr_time: t.arr }],
                    });
                }
            }

            for (const voyage of voyages) {
                const sequence = nextSeq(timetable.uuid);
                const voyageId = crypto.randomUUID();
                const departuresForVoyage = [];
                for (const leg of voyage.legs) {
                    const depPlaned = fmtPlanedAt(dateCopy, leg.dep_time);
                    const arrPlaned = fmtPlanedAt(dateCopy, leg.arr_time);
                    departuresForVoyage.push({
                        uuid: crypto.randomUUID(),
                        timetable_uuid: timetable.uuid,
                        line_uuid: line?.uuid || "",
                        line_code: rd.line_code,
                        line_name: rd.line_name,
                        sequence,
                        voyage_id: voyageId,
                        departure_harbor_id: leg.dep_harbor.code,
                        departure_harbor_name: leg.dep_harbor.name,
                        arrival_harbor_id: leg.arr_harbor.code,
                        arrival_harbor_name: leg.arr_harbor.name,
                        departure_planed: depPlaned,
                        departure: depPlaned,
                        arrival_planed: arrPlaned,
                        arrival: arrPlaned,
                        harbor_order: leg.harbor_order,
                        direction: voyage.direction,
                        boat_uuid: defaultBoat?.uuid || null,
                        base_capacity: defaultBoat?.capacity || null,
                        base_vip_capacity: defaultBoat?.vip_capacity || null,
                        base_pets_capacity: defaultBoat?.pets_capacity || null,
                        base_bicycle_capacity: defaultBoat?.bicycle_capacity || null,
                        ret_koef: 100,
                        is_active: true,
                        is_actual: true,
                    });
                }

                await sequelize.transaction(async (t) => {
                    await DeparturesModel.bulkCreate(departuresForVoyage, { transaction: t });

                    // Generate routes: every (start_leg, end_leg) pair where end_order >= start_order
                    const routesForVoyage = [];
                    for (const start of departuresForVoyage) {
                        const ends = departuresForVoyage.filter((e) => e.harbor_order >= start.harbor_order);
                        for (const end of ends) {
                            routesForVoyage.push({
                                uuid: crypto.randomUUID(),
                                code: `${timetable.code}-${start.departure_harbor_id}-${end.arrival_harbor_id}-${sequence}`,
                                timetable_uuid: timetable.uuid,
                                voyage_id: voyageId,
                                departure_uuid: null, // whole sailing has no single departure uuid across legs
                                sequence,
                                departure: start.departure,
                                actual_departure: start.departure,
                                departure_date: fmtRouteDate(dateCopy),
                                departure_time: start.departure.split(".").pop(),
                                arrival: end.arrival,
                                actual_arrival: end.arrival,
                                departure_harbor_order: start.harbor_order,
                                departure_harbor_id: start.departure_harbor_id,
                                departure_harbor_name: start.departure_harbor_name,
                                arrival_harbor_order: end.harbor_order + 10,
                                arrival_harbor_id: end.arrival_harbor_id,
                                arrival_harbor_name: end.arrival_harbor_name,
                                timetable_code: timetable.code,
                                timetable_name: timetable.name,
                                line_uuid: line?.uuid || "",
                                line_code: rd.line_code,
                                line_name: rd.line_name,
                                label: rd.line_name,
                                direction: voyage.direction,
                                is_active: true,
                                is_actual: true,
                            });
                        }
                    }
                    await RoutesModel.bulkCreate(routesForVoyage, { transaction: t });

                    // Set one "canonical" departure_uuid on each route = the first leg's uuid (start of full voyage)
                    const firstLegUuid = departuresForVoyage[0]?.uuid;
                    if (firstLegUuid) {
                        await RoutesModel.update(
                            { departure_uuid: firstLegUuid },
                            { where: { voyage_id: voyageId, departure_uuid: null }, transaction: t }
                        );
                    }
                });
            }
            console.log(`  + ${rd.line_code} ${dateCopy.toISOString().slice(0, 10)}: ${voyages.length} voyage(s)`);
        }
    }

    console.log("\n✓ seed complete");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
