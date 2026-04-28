const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");

async function fetchHarbors() {
    const coreConfig = await getCoreServiceConfigData();
    const boatUrl = coreConfig?.services?.boat?.url;
    if (!boatUrl) throw new Error("boat service URL missing in core config");
    const resp = await axios.get(`${boatUrl}/harbors`, { timeout: 8000 });
    return resp.data?.data?.harbors || [];
}

const harborTaxReportController = async (req, res) => {
    const { InvoiceModel, InvoiceItemsModel } = req.app.locals.models;
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

        const invoices = await InvoiceModel.findAll({
            where: { invoice_date: { [Op.gte]: start, [Op.lt]: end } },
            attributes: ["invoice_uuid", "invoice_canceled"],
        });
        if (invoices.length === 0) {
            return res.status(200).json({
                status: 200,
                data: { period: { year, month: month || null }, total_harbor_tax: 0, by_region: [] },
            });
        }

        const invoiceUuids = invoices.map((i) => i.invoice_uuid);
        const items = await InvoiceItemsModel.findAll({
            where: { invoice_uuid: { [Op.in]: invoiceUuids } },
            attributes: [
                "departure_harbor_id",
                "departure_harbor_name",
                "item_harbor_fee",
                "invoice_uuid",
            ],
        });

        const harbors = await fetchHarbors();
        const harborByCode = new Map(harbors.map((h) => [h.code, h]));

        // Aggregate by harbor code first
        const perHarbor = new Map();
        for (const it of items) {
            const code = it.departure_harbor_id || "";
            const fee = parseFloat(it.item_harbor_fee) || 0;
            const bucket = perHarbor.get(code) || {
                harbor_code: code,
                harbor_name: it.departure_harbor_name || harborByCode.get(code)?.name || code,
                tickets: 0,
                total: 0,
            };
            bucket.total += fee;
            bucket.tickets += 1;
            perHarbor.set(code, bucket);
        }

        // Group harbors by region
        const perRegion = new Map();
        for (const hb of perHarbor.values()) {
            const master = harborByCode.get(hb.harbor_code);
            const regionUuid = master?.region_uuid || "__UNKNOWN__";
            const regionName = master?.region || "Nepoznata lučka uprava";
            const bucket = perRegion.get(regionUuid) || {
                region_uuid: master?.region_uuid || null,
                region_name: regionName,
                total: 0,
                tickets: 0,
                harbors: [],
            };
            bucket.total += hb.total;
            bucket.tickets += hb.tickets;
            bucket.harbors.push({
                harbor_code: hb.harbor_code,
                harbor_name: hb.harbor_name,
                total: +hb.total.toFixed(2),
                tickets: hb.tickets,
            });
            perRegion.set(regionUuid, bucket);
        }

        const by_region = Array.from(perRegion.values())
            .map((r) => ({
                ...r,
                total: +r.total.toFixed(2),
                harbors: r.harbors.sort((a, b) => b.total - a.total),
            }))
            .sort((a, b) => b.total - a.total);

        const total_harbor_tax = +by_region.reduce((s, r) => s + r.total, 0).toFixed(2);

        res.status(200).json({
            status: 200,
            data: {
                period: { year, month: month || null },
                total_harbor_tax,
                by_region,
            },
        });
    } catch (error) {
        console.log("harborTaxReportController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { harborTaxReportController };
