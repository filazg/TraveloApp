// Seed Krilo.hr ticket prices into timetable_prices.
// Attaches to the adult "Putnik" ticket type. Run after seed_krilo.js.
//
// Usage:
//   node seed_krilo_prices.js              -> all routes, replaces active prices
//   node seed_krilo_prices.js --route=SD   -> one route
const crypto = require("crypto");
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize } = require("./config/database");
const { initModels } = require("./dbModels");

const VAT_RATE = 0.25;
const PORT_TAX_RATE = 0.06;
const splitFare = (total) => {
    const port = +(total * PORT_TAX_RATE).toFixed(2);
    const net = +(total - port).toFixed(2);
    const base = +(net / (1 + VAT_RATE)).toFixed(2);
    const vat = +(net - base).toFixed(2);
    return { port, base, vat };
};

// Harbor codes used in seed_krilo.js
const H = {
    SPLIT: "HR458",
    MILNA: "HR391",
    HVAR: "HR546",
    KORCULA: "HR491",
    POMENA: "HR543",
    DUBROVNIK: "Hr667",
    SUPETAR: "HR367",
    BOL: "HR555",
};

// Price matrices per line (EUR). Declared once-direction; reverse auto-generated.
const PRICES = {
    "KRILO-SD-MAIN": [
        [H.SPLIT, H.MILNA, 10],
        [H.SPLIT, H.HVAR, 25],
        [H.SPLIT, H.KORCULA, 30],
        [H.SPLIT, H.POMENA, 30],
        [H.SPLIT, H.DUBROVNIK, 50],
        [H.MILNA, H.HVAR, 15],
        [H.MILNA, H.KORCULA, 25],
        [H.MILNA, H.POMENA, 25],
        [H.MILNA, H.DUBROVNIK, 50],
        [H.HVAR, H.KORCULA, 25],
        [H.HVAR, H.POMENA, 25],
        [H.HVAR, H.DUBROVNIK, 50],
        [H.KORCULA, H.POMENA, 20],
        [H.KORCULA, H.DUBROVNIK, 25],
        [H.POMENA, H.DUBROVNIK, 20],
    ],
    "KRILO-SS-MAIN": [
        [H.SPLIT, H.SUPETAR, 10],
    ],
    "KRILO-SH-MAIN": [
        [H.SPLIT, H.HVAR, 25],
    ],
    "KRILO-SB-MAIN": [
        [H.SPLIT, H.BOL, 25],
    ],
};

(async () => {
    const args = { route: null };
    process.argv.slice(2).forEach((a) => {
        if (a.startsWith("--route=")) args.route = a.split("=")[1];
    });

    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const models = initModels();
    const { TimetablesModel, HarborsModel, TicketsTypesModel, TimetablePricesModel } = models;

    const harbors = await HarborsModel.findAll();
    const byCode = new Map(harbors.map((h) => [h.code, h]));
    const ticketTypes = await TicketsTypesModel.findAll({ where: { is_active: true } });
    // Prefer "Putnik" by name; fall back to first active.
    const mainTT = ticketTypes.find((t) => (t.name || "").toLowerCase() === "putnik") || ticketTypes[0];
    if (!mainTT) throw new Error("No active ticket type found — seed one first");
    console.log("Using ticket type:", mainTT.name, mainTT.uuid);

    const ttCodeMap = {
        SD: "KRILO-SD-MAIN",
        SS: "KRILO-SS-MAIN",
        SH: "KRILO-SH-MAIN",
        SB: "KRILO-SB-MAIN",
    };
    const ttCodes = args.route ? [ttCodeMap[args.route]].filter(Boolean) : Object.keys(PRICES);

    for (const ttCode of ttCodes) {
        const pairs = PRICES[ttCode];
        if (!pairs) { console.warn("Unknown timetable:", ttCode); continue; }

        const tt = await TimetablesModel.findOne({ where: { code: ttCode } });
        if (!tt) { console.warn("Timetable not found:", ttCode, "— run seed_krilo.js first"); continue; }

        // Deactivate old prices for this timetable (avoid stale data)
        await TimetablePricesModel.update(
            { is_active: false },
            { where: { timetable_uuid: tt.uuid } }
        );

        const rows = [];
        for (const [fromCode, toCode, totalEur] of pairs) {
            const from = byCode.get(fromCode);
            const to = byCode.get(toCode);
            if (!from || !to) {
                console.warn("  missing harbor:", fromCode, "or", toCode);
                continue;
            }
            const { port, base, vat } = splitFare(totalEur);
            // Both directions
            for (const [a, b] of [[from, to], [to, from]]) {
                rows.push({
                    uuid: crypto.randomUUID(),
                    timetable_uuid: tt.uuid,
                    harbor_from: a.name,
                    harbor_from_code: a.code,
                    harbor_from_uuid: a.uuid,
                    harbor_to: b.name,
                    harbor_to_code: b.code,
                    harbor_to_uuid: b.uuid,
                    ticket_type_uuid: mainTT.uuid,
                    ticket_type_name: mainTT.name,
                    ticket_type_name_eng: mainTT.name_eng || null,
                    seop_type: mainTT.seop_type || null,
                    price: totalEur,
                    vat_base: base,
                    vat_amount: vat,
                    port_tax: port,
                    vat_rate: VAT_RATE,
                    vat_name: "PDV 25%",
                    is_active: true,
                });
            }
        }
        await TimetablePricesModel.bulkCreate(rows);
        console.log(`  + ${ttCode}: inserted ${rows.length} price rows (${pairs.length} unique pairs × 2 directions)`);
    }

    console.log("\n✓ prices seed complete");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
