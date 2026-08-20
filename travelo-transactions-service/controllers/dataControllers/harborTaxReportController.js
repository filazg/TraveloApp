// Kumulativni izvještaj lučkih naknada po lučkim upravama.
//
// Naknada se pripisuje upravi koja stoji iza LUKE POLASKA te karte, pa je izvor
// tablica `tickets` — svaka karta nosi svoju luku polaska i cijenu. Račun kao
// izvor ne dolazi u obzir jer partnerska i T4B API prodaja karte upisuju bez
// stavki računa (partneru se izdaje periodični zbirni račun), pa bi te naknade
// ispale iz obračuna iako se lučkoj upravi duguju jednako.
//
// Naknada je 6% cijene karte, isto kao pri prodaji (splitAmount u
// finalize*SaleController), i računa se po karti da se poklopi sa zapisanim
// iznosima na stavkama računa.
const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");

const HARBOR_RATE = 0.06;

// Nazivi uprava znaju se razlikovati po razmacima i veličini slova, pa je
// rezervni ključ grupiranja normaliziran naziv.
const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toUpperCase();

async function fetchHarbors() {
    const coreConfig = await getCoreServiceConfigData();
    const boatUrl = coreConfig?.services?.boat?.url;
    if (!boatUrl) throw new Error("boat service URL missing in core config");
    const resp = await axios.get(`${boatUrl}/harbors`, { timeout: 8000 });
    return resp.data?.data?.harbors || [];
}

const harborTaxReportController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const year = parseInt(req.query.year, 10);
        const month = parseInt(req.query.month, 10);
        if (!year) {
            return res.status(400).json({ status: 400, data: { message: "year required" } });
        }

        let start, end;
        if (month) {
            start = new Date(year, month - 1, 1);
            end = new Date(year, month, 1);
        } else {
            start = new Date(year, 0, 1);
            end = new Date(year + 1, 0, 1);
        }

        // Agregacija ide u bazu — karata je puno više nego stavki računa, a ovdje
        // treba samo zbroj po luci polaska. Stornirane karte otpadaju (novac je
        // vraćen, pa se naknada ne duguje); is_canceled je na starijim zapisima
        // znao ostati NULL.
        const sequelize = TicketsModel.sequelize;
        const rows = await sequelize.query(
            `SELECT departure_harbor_id AS harbor_code,
                    max(departure_harbor_name) AS harbor_name,
                    count(*)::int AS tickets,
                    coalesce(sum(round(single_price * :rate, 2)), 0) AS total
             FROM tickets
             WHERE "createdAt" >= :start AND "createdAt" < :end
               AND coalesce(is_canceled, false) = false
             GROUP BY departure_harbor_id`,
            {
                replacements: { rate: HARBOR_RATE, start, end },
                type: sequelize.QueryTypes.SELECT,
            },
        );

        if (rows.length === 0) {
            return res.status(200).json({
                status: 200,
                data: { period: { year, month: month || null }, total_harbor_tax: 0, by_region: [] },
            });
        }

        const harbors = await fetchHarbors();
        const harborByCode = new Map(harbors.map((h) => [h.code, h]));

        // Grupiranje po upravi. Ključ je uuid luke-uprave; ako luka još nije
        // povezana s upravom (region_uuid prazan), grupira se po nazivu umjesto
        // da sve nepovezane luke padnu u isti koš.
        const perRegion = new Map();
        for (const row of rows) {
            const code = row.harbor_code || "";
            const master = harborByCode.get(code);
            const regionName = master?.region || "Nepoznata lučka uprava";
            const key = master?.region_uuid || norm(master?.region) || "__UNKNOWN__";

            const bucket = perRegion.get(key) || {
                region_uuid: master?.region_uuid || null,
                region_name: regionName,
                total: 0,
                tickets: 0,
                harbors: [],
            };
            const total = Number(row.total) || 0;
            bucket.total += total;
            bucket.tickets += row.tickets;
            bucket.harbors.push({
                harbor_code: code,
                harbor_name: row.harbor_name || master?.name || code,
                total: +total.toFixed(2),
                tickets: row.tickets,
            });
            perRegion.set(key, bucket);
        }

        const by_region = Array.from(perRegion.values())
            .map((r) => ({
                ...r,
                total: +r.total.toFixed(2),
                harbors: r.harbors.sort((a, b) => b.total - a.total),
            }))
            .sort((a, b) => b.total - a.total);

        const total_harbor_tax = +by_region.reduce((s, r) => s + r.total, 0).toFixed(2);
        const total_tickets = by_region.reduce((s, r) => s + r.tickets, 0);

        res.status(200).json({
            status: 200,
            data: {
                period: { year, month: month || null },
                total_harbor_tax,
                total_tickets,
                by_region,
            },
        });
    } catch (error) {
        console.log("harborTaxReportController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { harborTaxReportController };
