const crypto = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");

const { getSequelize } = require("../../config/database");
const { getModels } = require("../../dbModels");
const { getCoreServiceConfigData } = require("../configSyncController");

async function fetchPartnersFromBackoffice() {
    const coreConfig = await getCoreServiceConfigData();
    const boUrl = coreConfig?.services?.backoffice?.url;
    if (!boUrl) throw new Error("backoffice service URL missing from core config");
    const resp = await axios.get(`${boUrl}/partners`, { timeout: 10000 });
    return resp.data?.data?.partners || [];
}

async function generatePartnerInvoices({ asOfDate, onlyPartnerUuid } = {}) {
    const now = asOfDate ? new Date(asOfDate) : new Date();
    const currentYear = now.getFullYear();

    const { TicketsModel, PartnerInvoiceModel, PartnerInvoiceItemModel } = getModels();
    const sequelize = getSequelize();

    const partners = await fetchPartnersFromBackoffice();
    const partnersToProcess = onlyPartnerUuid
        ? partners.filter((p) => p.uuid === onlyPartnerUuid)
        : partners.filter((p) => p.is_active);

    const result = {
        processed_at: now.toISOString(),
        invoices: [],
        partners_skipped: [],
    };

    const maxRow = await PartnerInvoiceModel.findOne({
        where: { invoice_year: currentYear },
        order: [["partner_invoice_no", "DESC"]],
    });
    let nextNo = (maxRow?.partner_invoice_no || 0) + 1;

    for (const partner of partnersToProcess) {
        const tickets = await TicketsModel.findAll({
            where: {
                partner_uuid: partner.uuid,
                partner_invoice_uuid: null,
                [Op.or]: [{ is_canceled: false }, { is_canceled: null }],
                createdAt: { [Op.lte]: now },
            },
            order: [["createdAt", "ASC"]],
        });

        if (!tickets.length) {
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: "no unbilled tickets",
            });
            continue;
        }

        const commissionPct = parseFloat(partner.commission_pct) || 0;
        const vatRate = parseFloat(partner.vat_rate) || 0;
        const fiskalRequired = Boolean(partner.f2_required);

        let gross = 0;
        const ticketItems = tickets.map((t) => {
            const g = parseFloat(t.single_price) || 0;
            gross += g;
            return { ticket: t, gross: g };
        });
        gross = +gross.toFixed(2);

        const commissionAmount = +((gross * commissionPct) / 100).toFixed(2);
        const netAmount = +(gross - commissionAmount).toFixed(2);
        // option (b): net_amount includes VAT; extract VAT out of it
        const vatAmount = vatRate > 0 ? +((netAmount * vatRate) / (100 + vatRate)).toFixed(2) : 0;
        const vatBase = +(netAmount - vatAmount).toFixed(2);

        const items = ticketItems.map(({ ticket, gross: g }) => {
            const itemCommission = +((g * commissionPct) / 100).toFixed(2);
            const itemNet = +(g - itemCommission).toFixed(2);
            return { ticket, gross: g, commission: itemCommission, net: itemNet };
        });

        const periodFrom = tickets[0].createdAt;
        const periodTo = now;

        const invoiceUuid = crypto.randomUUID();
        const invoiceNo = nextNo;

        const tx = await sequelize.transaction();
        try {
            await PartnerInvoiceModel.create(
                {
                    partner_invoice_uuid: invoiceUuid,
                    partner_invoice_no: invoiceNo,
                    invoice_year: currentYear,
                    invoice_date: now,
                    period_from: periodFrom,
                    period_to: periodTo,
                    partner_uuid: partner.uuid,
                    partner_name: partner.partner_name,
                    partner_legal_id: partner.partner_legal_id,
                    partner_vat_id: partner.partner_vat_id,
                    partner_address: partner.partner_address,
                    partner_postal_code: partner.partner_postal_code,
                    partner_town: partner.partner_town,
                    partner_country: partner.partner_country,
                    tickets_count: tickets.length,
                    gross_amount: gross,
                    commission_pct: commissionPct,
                    commission_amount: commissionAmount,
                    net_amount: netAmount,
                    vat_rate: vatRate,
                    vat_base: vatBase,
                    vat_amount: vatAmount,
                    status: "issued",
                    fiskal_required: fiskalRequired,
                },
                { transaction: tx }
            );

            const itemsPayload = items.map(({ ticket, gross: g, commission, net }) => ({
                partner_invoice_uuid: invoiceUuid,
                ticket_uuid: ticket.ticket_uuid,
                order_uuid: ticket.order_uuid,
                order_note: ticket.order_note,
                sale_datetime: ticket.createdAt,
                ticket_code: ticket.ticket_code,
                ticket_type_name: ticket.ticket_type_name,
                route_uuid: ticket.route_uuid,
                line_code: ticket.line_code,
                line_name: ticket.line_name,
                departure_harbor_name: ticket.departure_harbor_name,
                arrival_harbor_name: ticket.arrival_harbor_name,
                departure: ticket.departure,
                gross_amount: g,
                commission_amount: commission,
                net_amount: net,
            }));
            await PartnerInvoiceItemModel.bulkCreate(itemsPayload, { transaction: tx });

            const ticketIds = tickets.map((t) => t.id);
            await TicketsModel.update(
                { partner_invoice_uuid: invoiceUuid },
                { where: { id: ticketIds }, transaction: tx }
            );

            await tx.commit();
            nextNo += 1;

            result.invoices.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                partner_invoice_uuid: invoiceUuid,
                partner_invoice_no: invoiceNo,
                tickets_count: tickets.length,
                gross_amount: gross,
                commission_pct: commissionPct,
                commission_amount: commissionAmount,
                net_amount: netAmount,
                vat_rate: vatRate,
                vat_base: vatBase,
                vat_amount: vatAmount,
                fiskal_required: fiskalRequired,
            });
        } catch (err) {
            try { await tx.rollback(); } catch (_) {}
            console.log(`partner ${partner.uuid} invoice generation failed:`, err.message);
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: `error: ${err.message}`,
            });
        }
    }

    return result;
}

const generatePartnerInvoicesController = async (req, res) => {
    try {
        const { as_of_date, partner_uuid } = req.body || {};
        const result = await generatePartnerInvoices({
            asOfDate: as_of_date || null,
            onlyPartnerUuid: partner_uuid || null,
        });
        res.status(200).json({ status: 200, data: result });
    } catch (error) {
        console.log("generatePartnerInvoicesController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const listPartnerInvoicesController = async (req, res) => {
    try {
        const { PartnerInvoiceModel } = getModels();
        const where = {};
        if (req.query.partner_uuid) where.partner_uuid = req.query.partner_uuid;

        const year = req.query.year ? parseInt(req.query.year, 10) : null;
        const month = req.query.month ? parseInt(req.query.month, 10) : null;
        if (year && month) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 1);
            where.invoice_date = { [Op.gte]: start, [Op.lt]: end };
        } else if (year) {
            where.invoice_year = year;
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
        const offset = parseInt(req.query.offset, 10) || 0;

        const { rows, count } = await PartnerInvoiceModel.findAndCountAll({
            where,
            order: [["invoice_year", "DESC"], ["partner_invoice_no", "DESC"]],
            limit,
            offset,
        });
        res.status(200).json({
            status: 200,
            data: { invoices: rows, total: count, limit, offset },
        });
    } catch (error) {
        console.log("listPartnerInvoicesController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const getPartnerInvoiceDetailsController = async (req, res) => {
    try {
        const { PartnerInvoiceModel, PartnerInvoiceItemModel } = getModels();
        const { partner_invoice_uuid } = req.params;
        const invoice = await PartnerInvoiceModel.findOne({
            where: { partner_invoice_uuid },
        });
        if (!invoice) {
            return res.status(404).json({ status: 404, data: { message: "not found" } });
        }
        const items = await PartnerInvoiceItemModel.findAll({
            where: { partner_invoice_uuid },
            order: [["id", "ASC"]],
        });
        res.status(200).json({ status: 200, data: { invoice, items } });
    } catch (error) {
        console.log("getPartnerInvoiceDetailsController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    generatePartnerInvoices,
    generatePartnerInvoicesController,
    listPartnerInvoicesController,
    getPartnerInvoiceDetailsController,
};
