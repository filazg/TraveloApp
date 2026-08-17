const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");

// Parse departure_planed → day-of-month (1..31) for the given target year/month.
// Supports: "DD.MM.YYYY[.HH:MM]", "DD/MM/YYYY[ HH:MM]", "YYYY-MM-DD[THH:MM]".
// Datum polaska kao sortabilan ISO ključ ("14.09.2026. 10:00" → "2026-09-14").
// Treba ga izvještaj Prodaja: ondje su stupci dani *kupnje*, pa se datum
// polaska ne može izvesti iz njih.
const departureDateKey = (str) => {
    // Kose crte dolaze iz web prodaje ("23/09/2026 09:00"), točke iz POS-a.
    const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(String(str || ""));
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ""));
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
};

const extractDayInMonth = (str, year, month) => {
    if (!str) return null;
    const s = String(str);
    let d, mo, y;
    let m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s);
    if (m) {
        d = parseInt(m[1], 10); mo = parseInt(m[2], 10); y = parseInt(m[3], 10);
    } else {
        m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
        if (!m) return null;
        y = parseInt(m[1], 10); mo = parseInt(m[2], 10); d = parseInt(m[3], 10);
    }
    if (y !== year || mo !== month) return null;
    return d;
};

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const fetchRoutesMap = async () => {
    const core = await getCoreServiceConfigData();
    const boatUrl = core?.services?.boat?.url;
    const salesUrl = core?.services?.sales?.url;
    // Prefer sales-service (cached with all active routes) — same list POS uses.
    const url = (salesUrl || boatUrl) + (salesUrl ? "/routes" : "/sales_routes");
    const resp = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    const routes = resp.data?.data?.routes || [];
    const map = new Map();
    for (const r of routes) {
        map.set(r.uuid, {
            timetable_uuid: r.timetable_uuid,
            sequence: r.sequence,
            line_code: r.line_code,
            line_name: r.line_name,
            direction: r.direction,
            departure_time: r.departure_time,
            departure_harbor_id: r.departure_harbor_id,
            departure_harbor_name: r.departure_harbor_name,
            arrival_harbor_id: r.arrival_harbor_id,
            arrival_harbor_name: r.arrival_harbor_name,
        });
    }
    return map;
};

const fetchCategoryMap = async () => {
    const core = await getCoreServiceConfigData();
    const bookingUrl = core?.services?.booking?.url;
    if (!bookingUrl) return new Map();
    const resp = await axios.get(`${bookingUrl}/ticket_type_mappings`, { timeout: 10000, validateStatus: () => true });
    const mappings = resp.data?.data?.mappings || resp.data?.mappings || [];
    const m = new Map();
    for (const row of mappings) m.set(row.ticket_type_uuid, row.category_code);
    return m;
};

// categoryKey maps category_code → bucket label used in UI ("putnici" / "zivotinje" / "bicikli").
const CATEGORY_BUCKET = {
    PASSANGER: "passengers",
    VIP: "passengers",
    PETS: "animals",
    BICYCLE: "bicycles",
};

const emptyDayBuckets = (days) => {
    const arr = new Array(days + 1).fill(null).map(() => ({ passengers: 0, animals: 0, bicycles: 0, amount: 0 }));
    return arr; // index 0 unused; days indexed 1..N
};

const sumBuckets = (target, source) => {
    for (let i = 1; i < target.length; i++) {
        target[i].passengers += source[i].passengers;
        target[i].animals += source[i].animals;
        target[i].bicycles += source[i].bicycles;
        target[i].amount += source[i].amount;
    }
};

const managementReportController = async (req, res) => {
    const { TicketsModel, InvoiceModel } = req.app.locals.models;
    try {
        const monthParam = req.query.month || "";
        const m = /^(\d{4})-(\d{1,2})$/.exec(monthParam);
        if (!m) return res.status(400).send({ status: 400, data: { message: "month=YYYY-MM required" } });
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const days = daysInMonth(year, month);
        // "travel" (default): distribute by ticket departure date.
        // "purchase": distribute by ticket sale (createdAt) date.
        const by = req.query.by === "purchase" ? "purchase" : "travel";

        // Fetch all active (non-canceled) tickets — filter by departure_planed prefix like "DD.MM.YYYY..."
        // Since departure_planed is a string, we cannot range-query in SQL precisely, so fetch broadly and filter in code.
        const tickets = await TicketsModel.findAll({
            where: {
                is_active: true,
                [Op.or]: [{ is_canceled: false }, { is_canceled: null }],
            },
            attributes: [
                "ticket_uuid", "route_uuid", "order_uuid", "line_code", "line_name",
                "departure_planed", "departure_harbor_id", "departure_harbor_name",
                "ticket_type_uuid", "single_price", "createdAt",
            ],
        });

        const [routeMap, categoryMap] = await Promise.all([fetchRoutesMap(), fetchCategoryMap()]);

        // Build order_uuid → business_premise map from invoices (POS + web sales produce invoices).
        const orderUuids = [...new Set(tickets.map((t) => t.order_uuid).filter(Boolean))];
        const bpByOrder = new Map();
        if (orderUuids.length) {
            const invoices = await InvoiceModel.findAll({
                where: { order_uuid: { [Op.in]: orderUuids } },
                attributes: ["order_uuid", "invoice_business_premise_uuid", "invoice_business_premise_name"],
            });
            for (const inv of invoices) {
                bpByOrder.set(inv.order_uuid, {
                    uuid: inv.invoice_business_premise_uuid || "",
                    name: inv.invoice_business_premise_name || "Nepoznato",
                });
            }
        }

        // Nested aggregation:
        //   { lines: Map<line_code, lineNode> }
        //   lineNode = { code, name, totals: [{passengers, animals, bicycles} × days], polasci: Map<polazakKey, polazakNode> }
        //   polazakNode = { key, timetable_uuid, sequence, direction, departure_time, totals, harbors: Map<harbor_id, harborNode> }
        //   harborNode = { harbor_id, harbor_name, totals }
        const lines = new Map();
        let matched = 0;
        for (const t of tickets) {
            let day = null;
            if (by === "purchase") {
                const c = t.createdAt ? new Date(t.createdAt) : null;
                if (c && !isNaN(c) && c.getFullYear() === year && c.getMonth() + 1 === month) {
                    day = c.getDate();
                }
            } else {
                day = extractDayInMonth(t.departure_planed, year, month);
            }
            if (!day || day < 1 || day > days) continue;
            const routeMeta = routeMap.get(t.route_uuid);
            const line_code = t.line_code || routeMeta?.line_code || "";
            const line_name = t.line_name || routeMeta?.line_name || "";
            if (!line_code) continue;
            const timetable_uuid = routeMeta?.timetable_uuid || "?";
            const sequence = routeMeta?.sequence ?? "?";
            const departure_time = routeMeta?.departure_time || "";
            const direction = routeMeta?.direction || "";
            const dep_harbor_id = t.departure_harbor_id || "";
            const dep_harbor_name = t.departure_harbor_name || "";
            // Arrival harbor is not directly on the ticket — derive from the compound route metadata.
            const arr_harbor_id = routeMeta?.arrival_harbor_id || "";
            const arr_harbor_name = routeMeta?.arrival_harbor_name || "";

            const catCode = categoryMap.get(t.ticket_type_uuid) || "PASSANGER";
            const bucket = CATEGORY_BUCKET[catCode] || "passengers";
            const price = Number(t.single_price) || 0;

            // LINE node
            let lineNode = lines.get(line_code);
            if (!lineNode) {
                lineNode = {
                    code: line_code,
                    name: line_name,
                    totals: emptyDayBuckets(days),
                    polasci: new Map(),
                };
                lines.set(line_code, lineNode);
            }
            lineNode.totals[day][bucket] += 1;
            lineNode.totals[day].amount += price;

            // POLAZAK node — grouped by schedule slot (timetable + departure_time + direction),
            // NOT by daily sequence. A slot like "Split→Dubrovnik 08:00" collapses all daily voyages.
            const pKey = `${timetable_uuid}|${departure_time}|${direction}`;
            let pNode = lineNode.polasci.get(pKey);
            if (!pNode) {
                pNode = {
                    key: pKey,
                    timetable_uuid,
                    sequence,
                    direction,
                    departure_time,
                    totals: emptyDayBuckets(days),
                    departure_dates: new Set(),
                    legs: new Map(),
                };
                lineNode.polasci.set(pKey, pNode);
            }
            const depKey = departureDateKey(t.departure_planed);
            if (depKey) pNode.departure_dates.add(depKey);
            pNode.totals[day][bucket] += 1;
            pNode.totals[day].amount += price;

            // LEG node — grouped by (dep harbor, arr harbor) pair = specific segment.
            const legKey = `${dep_harbor_id}|${arr_harbor_id}`;
            let lNode = pNode.legs.get(legKey);
            if (!lNode) {
                lNode = {
                    key: legKey,
                    departure_harbor_id: dep_harbor_id,
                    departure_harbor_name: dep_harbor_name,
                    arrival_harbor_id: arr_harbor_id,
                    arrival_harbor_name: arr_harbor_name,
                    totals: emptyDayBuckets(days),
                    premises: new Map(),
                };
                pNode.legs.set(legKey, lNode);
            }
            lNode.totals[day][bucket] += 1;
            lNode.totals[day].amount += price;

            // POSLOVNICA node — from invoice.business_premise for this ticket's order.
            const bp = bpByOrder.get(t.order_uuid) || { uuid: "", name: "Ostalo" };
            const bpKey = bp.uuid || bp.name;
            let bpNode = lNode.premises.get(bpKey);
            if (!bpNode) {
                bpNode = {
                    key: bpKey,
                    business_premise_uuid: bp.uuid,
                    business_premise_name: bp.name,
                    totals: emptyDayBuckets(days),
                };
                lNode.premises.set(bpKey, bpNode);
            }
            bpNode.totals[day][bucket] += 1;
            bpNode.totals[day].amount += price;
            matched += 1;
        }

        // Serialize Maps → arrays
        const linesOut = [];
        for (const line of lines.values()) {
            const polasciOut = [];
            for (const p of line.polasci.values()) {
                const legsOut = [...p.legs.values()].map((l) => {
                    const premisesOut = [...l.premises.values()].map((bp) => ({
                        key: bp.key,
                        business_premise_uuid: bp.business_premise_uuid,
                        business_premise_name: bp.business_premise_name,
                        totals: bp.totals.slice(1),
                    }));
                    premisesOut.sort((a, b) => a.business_premise_name.localeCompare(b.business_premise_name));
                    return {
                        key: l.key,
                        departure_harbor_id: l.departure_harbor_id,
                        departure_harbor_name: l.departure_harbor_name,
                        arrival_harbor_id: l.arrival_harbor_id,
                        arrival_harbor_name: l.arrival_harbor_name,
                        totals: l.totals.slice(1),
                        premises: premisesOut,
                    };
                });
                // Sort legs by departure then arrival harbor name.
                legsOut.sort((a, b) =>
                    a.departure_harbor_name.localeCompare(b.departure_harbor_name) ||
                    a.arrival_harbor_name.localeCompare(b.arrival_harbor_name)
                );
                polasciOut.push({
                    key: p.key,
                    timetable_uuid: p.timetable_uuid,
                    sequence: p.sequence,
                    direction: p.direction,
                    departure_time: p.departure_time,
                    departure_dates: [...p.departure_dates].sort(),
                    totals: p.totals.slice(1),
                    legs: legsOut,
                });
            }
            polasciOut.sort((a, b) => (a.departure_time || "").localeCompare(b.departure_time || "") || String(a.sequence).localeCompare(String(b.sequence)));
            linesOut.push({
                code: line.code,
                name: line.name,
                totals: line.totals.slice(1),
                polasci: polasciOut,
            });
        }
        linesOut.sort((a, b) => a.code.localeCompare(b.code));

        return res.send({
            status: 200,
            data: {
                year,
                month,
                days,
                tickets_matched: matched,
                lines: linesOut,
            },
        });
    } catch (error) {
        console.log("managementReportController error:", error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { managementReportController };
