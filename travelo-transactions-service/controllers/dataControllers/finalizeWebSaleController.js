const crypto = require("crypto");
const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");
const { buildInvoicePdfBuffer } = require("./invoicePdfController");
const { buildTicketsPdfBuffer } = require("./ticketPdfController");
const { sendWebSaleEmail } = require("../../helpers/webSaleEmail");
const { reserveBookings } = require("../../helpers/bookingClient");

const randomCode = () => crypto.randomBytes(5).toString("hex").toUpperCase();

// Fiscal split — matches the legacy template:
//   port tax = 6% of amount
//   VAT base = (amount − port_tax) / 1.25   (25% PDV)
//   VAT      = (amount − port_tax) − VAT base
const HARBOR_RATE = 0.06;
const VAT_RATE = 0.25;
const splitAmount = (amount) => {
    const port = +(amount * HARBOR_RATE).toFixed(2);
    const net = amount - port;
    const base = +(net / (1 + VAT_RATE)).toFixed(2);
    const vat = +(net - base).toFixed(2);
    return { port, base, vat };
};

// HR fisk: broj računa mora biti kontinuirani unutar (uređaj × godina).
const nextInvoiceNo = async (InvoiceModel, year, billingDeviceUuid) => {
    const max = await InvoiceModel.max("invoice_no", {
        where: { invoice_year: year, invoice_billing_device_uuid: billingDeviceUuid },
    });
    return Number.isFinite(max) ? max + 1 : 1;
};

// Fiskalni broj — sekvencijalan samo za F1 račune (F2 ima NULL pa ga max ignorira).
const nextInvoiceFiskalNo = async (InvoiceModel, year, billingDeviceUuid) => {
    const max = await InvoiceModel.max("invoice_fiskal_no", {
        where: { invoice_year: year, invoice_billing_device_uuid: billingDeviceUuid },
    });
    return Number.isFinite(max) ? max + 1 : 1;
};

const loadFiscalContext = async () => {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const backofficeUrl = coreConfig?.services?.backoffice?.url;
        if (!backofficeUrl) return {};

        const [companyResp, bpResp, bdResp, csResp] = await Promise.all([
            axios.get(`${backofficeUrl}/company`, { timeout: 5000, validateStatus: () => true }),
            axios.get(`${backofficeUrl}/business_premises`, { timeout: 5000, validateStatus: () => true }),
            axios.get(`${backofficeUrl}/billing_devices`, { timeout: 5000, validateStatus: () => true }),
            axios.get(`${backofficeUrl}/channel_settings/web`, { timeout: 5000, validateStatus: () => true }),
        ]);

        const company = companyResp.data?.data?.company || null;
        const bps = bpResp.data?.data?.business_premises || [];
        const bds = bdResp.data?.data?.billing_devices || [];

        // Postavke kanala (Administracija → Web prodaja) su mjerodavne ako su
        // postavljene. Tek ako nisu, vrijedi staro pravilo: JEDINI aktivni premise
        // tipa Web prodaja (WEB_OFFICE) + njegov JEDINI aktivni uređaj.
        const cs = csResp.data?.data?.channel_settings || null;
        if (cs && cs.is_active && cs.business_premise_uuid && cs.billing_device_uuid) {
            const bp = bps.find((x) => x.uuid === cs.business_premise_uuid);
            const bd = bds.find((x) => x.uuid === cs.billing_device_uuid);
            if (bp && bd) {
                return { company, businessPremise: bp, billingDevice: bd, channelSettings: cs };
            }
            console.log(
                "finalizeWebSale: postavke kanala pokazuju na nepostojeće prodajno mjesto ili uređaj — koristim zatečeno pravilo"
            );
        }

        const webBp = bps.find((bp) => bp.type === "WEB_OFFICE" && bp.is_active);
        if (!webBp) {
            throw new Error("Nema aktivnog prodajnog mjesta tipa Web prodaja. Dodajte ga u Backoffice → Prodajna mjesta.");
        }
        const webBd = bds.find((bd) => bd.business_premise_uuid === webBp.uuid && bd.is_active);
        if (!webBd) {
            throw new Error(`Prodajno mjesto "${webBp.name}" nema aktivan naplatni uređaj. Dodajte ga u Backoffice → Naplatni uređaji.`);
        }

        return { company, businessPremise: webBp, billingDevice: webBd };
    } catch (err) {
        console.log("loadFiscalContext error:", err?.message || err);
        return {};
    }
};

const finalizeWebSaleController = async (req, res) => {
    const models = req.app.locals.models;
    const { TicketsModel, InvoiceModel, InvoiceItemsModel, InvoiceItemDetailsModel } = models;
    try {
        const body = req.body || {};
        const {
            payment_reference,
            buyer = {},
            orders = [],
            language = "hr",
            monri_meta = {},
        } = body;

        if (!payment_reference || !orders.length) {
            return res.status(400).json({ status: 400, data: { message: "payment_reference and orders required" } });
        }

        const fiscal = await loadFiscalContext();
        const company = fiscal.company || {};
        const bp = fiscal.businessPremise || {};
        const bd = fiscal.billingDevice || {};
        const cs = fiscal.channelSettings || {};
        // Jezik s postavki kanala vrijedi kad ga kupac nije izabrao.
        const invoiceLanguage = language || cs.invoice_language || "hr";

        const invoice_uuid = crypto.randomUUID();
        const invoiceDate = new Date();
        let total_amount = 0;
        let total_vat_base = 0;
        let total_vat = 0;
        let total_harbor_tax = 0;

        const invoiceItemsToAdd = [];
        const invoiceItemDetailsToAdd = [];
        const ticketsToAdd = [];
        const orderLinks = [];

        for (const order of orders) {
            const items = Array.isArray(order.items) ? order.items : [];
            if (!items.length) continue;

            const itemUuid = crypto.randomUUID();
            const itemAmount = items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
            const { port: itemHarborFee, base: itemVatBase, vat: itemVat } = splitAmount(itemAmount);

            total_amount += itemAmount;
            total_vat_base += itemVatBase;
            total_vat += itemVat;
            total_harbor_tax += itemHarborFee;

            invoiceItemsToAdd.push({
                item_uuid: itemUuid,
                invoice_uuid,
                route_uuid: order.route_uuid,
                line_code: order.line_code || "",
                line_name: order.line_name || "",
                departure: `${order.departure_date || ""} ${order.departure_time || ""}`.trim(),
                departure_harbor_id: order.departure_harbor_code || "",
                departure_harbor_name: order.departure_harbor_name || "",
                arrival: `${order.departure_date || ""} ${order.departure_time || ""}`.trim(),
                arrival_harbor_id: order.arrival_harbor_code || "",
                arrival_harbor_name: order.arrival_harbor_name || "",
                item_amount: itemAmount,
                item_vat_base: itemVatBase,
                item_vat: itemVat,
                item_harbor_fee: itemHarborFee,
            });

            for (const it of items) {
                const qty = Number(it.qty || 0);
                const unit = Number(it.unit_price || 0);
                const subtotal = Number(it.subtotal || qty * unit);
                const { port: detailHarbor, base: detailVatBase, vat: detailVat } = splitAmount(subtotal);

                invoiceItemDetailsToAdd.push({
                    item_details_uuid: crypto.randomUUID(),
                    item_uuid: itemUuid,
                    ticket_type_name: it.ticket_type_name || "",
                    ticket_type_uuid: it.ticket_type_uuid || "",
                    quantity: qty,
                    single_price: unit,
                    item_amount: subtotal,
                    item_vat_base: detailVatBase,
                    item_vat: detailVat,
                    item_harbor_fee: detailHarbor,
                });

                const departurePlanned = `${order.departure_date || ""} ${order.departure_time || ""}`.trim();
                for (let i = 0; i < qty; i++) {
                    const ticket_uuid = crypto.randomUUID();
                    ticketsToAdd.push({
                        ticket_uuid,
                        ticket_code: randomCode(),
                        order_uuid: order.order_uuid,
                        order_number: `WS-${payment_reference.slice(0, 8)}`,
                        ticket_group_uuid: it.ticket_type_uuid,
                        ticket_type_uuid: it.ticket_type_uuid,
                        ticket_type_name: it.ticket_type_name,
                        single_price: unit,
                        is_active: true,
                        is_canceled: false,
                        route_uuid: order.route_uuid,
                        departure_planed: departurePlanned,
                        departure: departurePlanned,
                        line_code: order.line_code || null,
                        line_name: order.line_name || null,
                        departure_harbor_id: order.departure_harbor_code,
                        departure_harbor_name: order.departure_harbor_name,
                        arrival_planed: null,
                        arrival: null,
                        arrival_harbor_id: order.arrival_harbor_code,
                        arrival_harbor_name: order.arrival_harbor_name,
                        deactivate: false,
                        status: "created",
                        ticket_qr: ticket_uuid,
                        passanger_email: buyer.summary_buyer_email || null,
                        passanger_name: buyer.summary_buyer_name || null,
                        // Otočna karta: SEOP podaci putuju s itemom kroz orders → finalize
                        // i ispisuju se na karti za vizualnu provjeru pri ukrcaju.
                        is_island: it.is_island === true,
                        seop_card_no: it.seop_card_no || null,
                        seop_pravo: it.seop_pravo || null,
                        seop_otok: it.seop_otok || null,
                        seop_discount_pct: it.seop_discount_pct ?? null,
                    });
                }
            }

            orderLinks.push(order.order_uuid);
        }

        if (!ticketsToAdd.length) {
            return res.status(400).json({ status: 400, data: { message: "no tickets to create" } });
        }

        total_amount = +total_amount.toFixed(2);
        total_vat_base = +total_vat_base.toFixed(2);
        total_vat = +total_vat.toFixed(2);
        total_harbor_tax = +total_harbor_tax.toFixed(2);

        const invoice_year = invoiceDate.getFullYear();
        const invoice_no = await nextInvoiceNo(InvoiceModel, invoice_year, bd.uuid);
        // F2 = kupac dao OIB → nema fiskalni broj (e-račun). Inače sekvencijalni F1 broj.
        // Fiskalizacija: R1 (kupac s OIB-om) uvijek, inače kako je postavljeno na kanalu.
        const fiskalRequired = Boolean(buyer.summary_buyer_company_vat_id) || cs.fiskal_required === true;
        const invoice_fiskal_no = fiskalRequired
            ? null
            : await nextInvoiceFiskalNo(InvoiceModel, invoice_year, bd.uuid);
        const invoice_code = invoice_fiskal_no && bp.fiskal_mark && bd.fiscal_mark
            ? `${invoice_fiskal_no}/${bp.fiskal_mark}/${bd.fiscal_mark}`
            : null;

        await InvoiceModel.create({
            invoice_uuid,
            invoice_no,
            invoice_fiskal_no,
            invoice_code,
            invoice_year,
            invoice_date: invoiceDate,
            invoice_is_pay: true,
            invoice_payment_data: monri_meta,
            invoice_payment_method_uuid: cs.payment_method_uuid || null,
            invoice_payment_method_name: cs.payment_method_name || "Monri",
            // Company (issuer) snapshot
            company_name: company.name || null,
            company_address: company.address || null,
            company_postal_code: company.postal_code || null,
            company_town: company.town || null,
            company_id: company.legal_id || null,
            company_vatid: company.vat_id || null,
            // Business premise + billing device (no JIR/ZKI yet — fiscalization TODO)
            invoice_business_premise_uuid: bp.uuid || null,
            invoice_business_premise_name: bp.name || null,
            invoice_business_premise_fiscal_mark: bp.fiskal_mark || null,
            invoice_billing_device_uuid: bd.uuid || null,
            invoice_billing_device_fiscal_mark: bd.fiscal_mark || null,
            invoice_operator_name: "WEB PRODAJA",
            // Buyer
            buyer_name: buyer.summary_buyer_name || null,
            buyer_email: buyer.summary_buyer_email || null,
            buyer_tel: buyer.summary_buyer_phone || null,
            buyer_company_name: buyer.summary_buyer_company_name || null,
            buyer_address: buyer.summary_buyer_company_address || null,
            buyer_oib: buyer.summary_buyer_company_vat_id || null,
            buyer_postal_code: buyer.summary_buyer_company_postal_code || null,
            buyer_town: buyer.summary_buyer_company_town || null,
            buyer_country: buyer.summary_buyer_company_country || null,
            // Totals
            invoice_amount: total_amount,
            invoice_vat_base: total_vat_base,
            invoice_vat: total_vat,
            invoice_harbor_tax: total_harbor_tax,
            order_uuid: orderLinks.join(","),
            language: invoiceLanguage,
            invoice_status: "paid",
            invoice_canceled: false,
            // F2 fiscalization: required when buyer submitted R1 (OIB present)
            fiskal_required: fiskalRequired,
        });
        await InvoiceItemsModel.bulkCreate(invoiceItemsToAdd);
        await InvoiceItemDetailsModel.bulkCreate(invoiceItemDetailsToAdd);
        await TicketsModel.bulkCreate(ticketsToAdd);

        // F2 fiskalizacija preko YesCor — ako je buyer dao OIB.
        if (fiskalRequired) {
            try {
                const { sendInvoiceToYescor } = require("../integrations/sendInvoiceToYescor");
                const result = await sendInvoiceToYescor({
                    invoice: {
                        invoice_uuid,
                        invoice_no,
                        invoice_fiskal_no,
                        invoice_year,
                        invoice_date: invoiceDate,
                        invoice_code,
                        invoice_vat_base: total_vat_base,
                        invoice_vat: total_vat,
                        invoice_harbor_tax: total_harbor_tax,
                        invoice_amount: total_amount,
                    },
                    items: invoiceItemsToAdd,
                    company,
                    operator: { mark: "WEB", oib: company.legal_id || company.vat_id || "" },
                    buyer: {
                        buyer_name: buyer.summary_buyer_name,
                        buyer_oib: buyer.summary_buyer_company_vat_id,
                        buyer_company_name: buyer.summary_buyer_company_name,
                        buyer_address: buyer.summary_buyer_company_address,
                        buyer_postal_code: buyer.summary_buyer_company_postal_code,
                        buyer_town: buyer.summary_buyer_company_town,
                        buyer_country: buyer.summary_buyer_company_country || "HR",
                    },
                    paymentMeans: "48", // web = card (Monri)
                });
                const data = result.response?.data;
                const yescorDocId = typeof data === "string" ? data : data?.data;
                await InvoiceModel.update(
                    {
                        yescor_document_id: yescorDocId || null,
                        yescor_status: result.response?.status >= 200 && result.response?.status < 300
                            ? "submitted" : "failed",
                        yescor_last_sync_at: new Date(),
                        yescor_raw_response: data || null,
                    },
                    { where: { invoice_uuid } }
                );
                console.log("web-sale YesCor submit:", result.response?.status, yescorDocId || data?.error?.message);
            } catch (yescorErr) {
                console.log("web-sale YesCor submit failed:", yescorErr?.message || yescorErr);
                try {
                    await InvoiceModel.update(
                        { yescor_status: "failed", yescor_error_message: yescorErr?.message, yescor_last_sync_at: new Date() },
                        { where: { invoice_uuid } }
                    );
                } catch (_) { /* ignore */ }
            }
        }

        // Reserve capacity — one row per ticket row. Payment already succeeded so
        // overbooking is logged (not thrown); capacity should be reserved earlier.
        const reserveItems = ticketsToAdd
            .filter((t) => t.route_uuid && t.ticket_type_uuid)
            .map((t) => ({ route_uuid: t.route_uuid, ticket_type_uuid: t.ticket_type_uuid, qty: 1 }));
        if (reserveItems.length) {
            try {
                await reserveBookings(reserveItems);
            } catch (err) {
                console.log("web-sale finalize booking reserve failed:", err?.message || err);
            }
        }

        // Fire-and-forget email with both PDFs attached. Email failures must not
        // fail the webhook — log and continue.
        (async () => {
            try {
                const [invoicePdf, ticketsPdf] = await Promise.all([
                    buildInvoicePdfBuffer({ models, invoice_uuid }),
                    buildTicketsPdfBuffer({ TicketsModel, order_uuids: orderLinks }),
                ]);
                await sendWebSaleEmail({
                    to: buyer.summary_buyer_email,
                    lang: invoiceLanguage === "en" ? "en" : "hr",
                    buyerName: buyer.summary_buyer_name,
                    invoicePdf,
                    ticketsPdf,
                });
            } catch (mailErr) {
                console.log("web-sale email failed:", mailErr?.message || mailErr);
            }
        })();

        res.status(200).json({
            status: 200,
            data: {
                invoice_uuid,
                total_amount,
                tickets_count: ticketsToAdd.length,
                order_uuids: orderLinks,
            },
        });
    } catch (error) {
        console.log("finalizeWebSaleController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { finalizeWebSaleController };
