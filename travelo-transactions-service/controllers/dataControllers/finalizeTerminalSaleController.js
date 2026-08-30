const crypto = require("crypto");
const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");
const { reserveBookings } = require("../../helpers/bookingClient");
const { sendInvoiceToYescor } = require("../integrations/sendInvoiceToYescor");
const { podigniSignal } = require("./syncSignalsController");

const randomCode = () => crypto.randomBytes(5).toString("hex").toUpperCase();

// Fiscal split — port tax 6%, VAT 25% on the rest (matches legacy + web-sale).
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

// Sequential per (billing_device, year). Legacy Croatian F1 fiscal number.
const nextInvoiceFiskalNo = async (InvoiceModel, year, billingDeviceUuid) => {
    const max = await InvoiceModel.max("invoice_fiskal_no", {
        where: { invoice_year: year, invoice_billing_device_uuid: billingDeviceUuid },
    });
    return Number.isFinite(max) ? max + 1 : 1;
};

// Tvrtka, poslovni prostori i naplatni uređaji mijenjaju se rijetko, a dohvaćali
// su se pri SVAKOJ prodaji — svaki poziv ide na backoffice, a njegova baza je u
// Amsterdamu (~100 ms po turi, hladno spajanje preko sekunde). Kad se hladni
// pozivi poklope, rok od 5 s se probije i cijela prodaja padne s 500, iako se
// radi o podacima koji se nisu promijenili tjednima.
//
// Zato se drže u kratkom kešu. Zadnji uspješan dohvat čuva se i kao zaliha bez
// roka: ako backoffice zakaže, radije se izda račun s podacima od maloprije nego
// da se prodaja odbije — terminal ionako čuva sve lokalno i gura sinkom.
const FISCAL_CACHE_TTL_MS = 5 * 60 * 1000;
let fiscalCache = { at: 0, data: null };

const fetchFiscalReferences = async () => {
    const coreConfig = await getCoreServiceConfigData();
    const boUrl = coreConfig?.services?.backoffice?.url;
    if (!boUrl) throw new Error("backoffice service URL missing in core config");

    const [companyResp, bpResp, bdResp] = await Promise.all([
        axios.get(`${boUrl}/company`, { timeout: 15000, validateStatus: () => true }),
        axios.get(`${boUrl}/business_premises`, { timeout: 15000, validateStatus: () => true }),
        axios.get(`${boUrl}/billing_devices`, { timeout: 15000, validateStatus: () => true }),
    ]);

    const company = companyResp.data?.data?.company || {};
    const bps = bpResp.data?.data?.business_premises || [];
    const bds = bdResp.data?.data?.billing_devices || [];
    // Prazna lista uređaja znači da backoffice nije stvarno odgovorio (npr. 500
    // uz validateStatus), pa je ne spremaj preko dobrog keša.
    if (!bds.length) throw new Error("backoffice vratio prazan popis naplatnih uređaja");
    return { company, businessPremises: bps, billingDevices: bds };
};

const loadFiscalReferences = async () => {
    const fresh = Date.now() - fiscalCache.at < FISCAL_CACHE_TTL_MS;
    if (fresh && fiscalCache.data) return fiscalCache.data;
    try {
        const data = await fetchFiscalReferences();
        fiscalCache = { at: Date.now(), data };
        return data;
    } catch (error) {
        if (fiscalCache.data) {
            console.log("loadFiscalReferences: backoffice nedostupan, koristim zadnje poznate podatke:", error?.message || error);
            return fiscalCache.data;
        }
        throw error;
    }
};

const loadFiscalContext = async (terminalUuid) => {
    let refs = await loadFiscalReferences();
    let bd = refs.billingDevices.find((x) => x.uuid === terminalUuid);
    // Uređaj kojeg nema u kešu je vjerojatno tek dodan u backofficeu — osvježi
    // jednom prije nego odbiješ prodaju, inače novi terminal ne bi mogao raditi
    // dok keš ne istekne.
    if (!bd && fiscalCache.at) {
        fiscalCache = { at: 0, data: fiscalCache.data };
        refs = await loadFiscalReferences();
        bd = refs.billingDevices.find((x) => x.uuid === terminalUuid);
    }
    if (!bd) throw new Error(`billing device ${terminalUuid} not found`);
    const bp = refs.businessPremises.find((x) => x.uuid === bd.business_premise_uuid) || {};
    return { company: refs.company, businessPremise: bp, billingDevice: bd };
};

const finalizeTerminalSaleController = async (req, res) => {
    const models = req.app.locals.models;
    const { TicketsModel, InvoiceModel, InvoiceItemsModel, InvoiceItemDetailsModel } = models;
    console.log('[finalizeSale RX]', JSON.stringify({
        invoice_uuid: req.body?.invoice_uuid,
        invoice_no: req.body?.invoice_no,
        invoice_year: req.body?.invoice_year,
        invoice_code: req.body?.invoice_code,
        is_f2: req.body?.is_f2,
        ticket_count: Array.isArray(req.body?.tickets) ? req.body.tickets.length : 'no-array',
        first_ticket_uuid: req.body?.tickets?.[0]?.ticket_uuid,
    }));
    try {
        const {
            items = [],
            terminal_uuid,
            payment_method_uuid,
            // Odgovor platnog uredaja (7pay na mobilnom terminalu) — zapisuje se
            // uz racun da se transakcija moze povezati s naplatom i stornirati.
            payment_data = null,
            operator = {},
            buyer = {},
            // Client-provided fiskalni identifikatori — POS (NU) je autoritativni
            // izvor brojeva i ID-eva; backend ih SAMO zapisuje 1:1. Fallback na
            // backend-generaciju samo ako nisu poslani (legacy/non-mobile pozivi).
            invoice_uuid: client_invoice_uuid,
            invoice_no: client_invoice_no,
            invoice_year: client_invoice_year,
            invoice_fiskal_no: client_invoice_fiskal_no,
            invoice_code: client_invoice_code,
            is_f2: client_is_f2,
            order_uuid: client_order_uuid,
            tickets: client_tickets,
        } = req.body || {};

        if (!terminal_uuid) return res.status(400).json({ status: 400, data: { message: "terminal_uuid required" } });
        if (!payment_method_uuid) return res.status(400).json({ status: 400, data: { message: "payment_method_uuid required" } });
        if (!items.length) return res.status(400).json({ status: 400, data: { message: "no tickets in cart" } });

        // Ista prodaja poslana dvaput. Terminal gura zaostatak sve dok ne dobije
        // potvrdu, pa nakon isteka veze zna poslati račun koji je već zapisan —
        // odgovor se izgubio, a prodaja je prošla. Bez ove provjere nastane
        // drugi račun i druge karte s istim uuid-ima: izvještaji broje duplo, a
        // storno padne s "only 2/1 tickets found".
        //
        // Provjera stoji prije rezervacije mjesta, jer bi ponovljeni zahtjev
        // inače drugi put umanjio raspoloživost polaska.
        if (client_invoice_uuid) {
            const vecZapisan = await InvoiceModel.findOne({
                where: { invoice_uuid: client_invoice_uuid },
            });
            if (vecZapisan) {
                const karte = await TicketsModel.findAll({
                    where: { invoice_uuid: client_invoice_uuid },
                });
                console.log("[finalizeSale] racun", client_invoice_uuid, "je vec zapisan — ponovljeni zahtjev, nista se ne stvara");
                return res.status(200).json({
                    status: 200,
                    data: {
                        invoice_uuid: vecZapisan.invoice_uuid,
                        invoice_no: vecZapisan.invoice_no,
                        invoice_fiskal_no: vecZapisan.invoice_fiskal_no,
                        invoice_year: vecZapisan.invoice_year,
                        invoice_code: vecZapisan.invoice_code,
                        is_f2: Boolean(vecZapisan.fiskal_required),
                        order_uuid: vecZapisan.order_uuid,
                        total_amount: vecZapisan.invoice_amount,
                        total_vat_base: vecZapisan.invoice_vat_base,
                        total_vat: vecZapisan.invoice_vat,
                        total_harbor_tax: vecZapisan.invoice_harbor_tax,
                        payment_method_name: vecZapisan.invoice_payment_method_name,
                        tickets_count: karte.length,
                        fiskal_required: Boolean(vecZapisan.fiskal_required),
                        already_recorded: true,
                        tickets: karte.map((t) => ({
                            ticket_uuid: t.ticket_uuid,
                            ticket_code: t.ticket_code,
                            ticket_qr: t.ticket_qr,
                            order_uuid: t.order_uuid,
                            ticket_type_uuid: t.ticket_type_uuid,
                            ticket_type_name: t.ticket_type_name,
                            line_code: t.line_code,
                            line_name: t.line_name,
                            route_uuid: t.route_uuid,
                            departure_harbor_id: t.departure_harbor_id,
                            departure_harbor_name: t.departure_harbor_name,
                            arrival_harbor_id: t.arrival_harbor_id,
                            arrival_harbor_name: t.arrival_harbor_name,
                            departure_planed: t.departure_planed,
                            single_price: t.single_price,
                            status: t.status,
                            validate_data: t.validate_data,
                        })),
                    },
                });
            }
        }

        const { company, businessPremise: bp, billingDevice: bd } = await loadFiscalContext(terminal_uuid);
        const pmList = bd.payment || bd.payment_methods || [];
        const pm = pmList.find((x) => x.uuid === payment_method_uuid);
        if (!pm) return res.status(400).json({ status: 400, data: { message: "payment method does not belong to terminal" } });

        // Reserve capacity first so overbooking aborts BEFORE any DB writes.
        const reserveItems = items
            .filter((i) => i.route?.route_uuid && i.ticket_type_uuid && (parseInt(i.qty, 10) || 0) > 0)
            .map((i) => ({
                route_uuid: i.route.route_uuid,
                ticket_type_uuid: i.ticket_type_uuid,
                qty: parseInt(i.qty, 10),
            }));
        if (reserveItems.length) {
            try {
                await reserveBookings(reserveItems);
            } catch (err) {
                if (err.bookingRejection) {
                    return res.status(409).json({ status: 409, data: { message: err.message } });
                }
                throw err;
            }
        }

        // Klijent (mobile/POS) MORA dodjeljivati fiskalne brojeve sam (HR fisk pravilo
        // za NU). Sve niže koristimo client_* ako je poslan, inače fallback generacija
        // za legacy pozivatelje (web, partner backoffice).
        const invoiceDate = new Date();
        const invoice_uuid = client_invoice_uuid || crypto.randomUUID();
        const invoice_year = client_invoice_year || invoiceDate.getFullYear();
        const fiskalRequired = (client_is_f2 != null) ? Boolean(client_is_f2) : Boolean(buyer.f2_required);
        const invoice_no = client_invoice_no
            || (await nextInvoiceNo(InvoiceModel, invoice_year, bd.uuid));
        const invoice_fiskal_no = client_invoice_fiskal_no != null
            ? client_invoice_fiskal_no
            : (fiskalRequired ? null : await nextInvoiceFiskalNo(InvoiceModel, invoice_year, bd.uuid));
        // F1 → NO/PP/NU, F2 → 8-char random kod (mobile ga šalje u client_invoice_code).
        const invoice_code = client_invoice_code
            || (invoice_fiskal_no && bp.fiskal_mark && bd.fiscal_mark
                ? `${invoice_fiskal_no}/${bp.fiskal_mark}/${bd.fiscal_mark}`
                : null);
        const order_uuid = client_order_uuid || crypto.randomUUID();
        // Map client-provided ticket UUIDs/codes (po redoslijedu items × qty) tako da
        // POS i backend imaju IDENTIČNE ticket_uuid-e i kasnije cancel_tickets nađe ih.
        const clientTicketsByOrder = Array.isArray(client_tickets) ? client_tickets : [];
        let clientTicketIdx = 0;

        let total_amount = 0;
        let total_vat_base = 0;
        let total_vat = 0;
        let total_harbor_tax = 0;

        const invoiceItemsToAdd = [];
        const invoiceItemDetailsToAdd = [];
        const ticketsToAdd = [];

        for (const it of items) {
            const qty = Math.max(0, parseInt(it.qty, 10) || 0);
            if (!qty) continue;
            const unit = parseFloat(it.unit_price) || 0;
            const subtotal = +(unit * qty).toFixed(2);
            const { port, base, vat } = splitAmount(subtotal);

            total_amount += subtotal;
            total_vat_base += base;
            total_vat += vat;
            total_harbor_tax += port;

            const itemUuid = crypto.randomUUID();
            const r = it.route || {};
            invoiceItemsToAdd.push({
                item_uuid: itemUuid,
                invoice_uuid,
                route_uuid: r.route_uuid || "",
                line_code: r.line_code || "",
                line_name: r.line_name || "",
                departure: r.departure_planned || "",
                departure_harbor_id: r.departure_harbor_id || "",
                departure_harbor_name: r.departure_harbor_name || "",
                arrival: r.arrival_planned || "",
                arrival_harbor_id: r.arrival_harbor_id || "",
                arrival_harbor_name: r.arrival_harbor_name || "",
                item_amount: subtotal,
                item_vat_base: base,
                item_vat: vat,
                item_harbor_fee: port,
            });
            const perUnit = splitAmount(unit);
            invoiceItemDetailsToAdd.push({
                item_details_uuid: crypto.randomUUID(),
                item_uuid: itemUuid,
                ticket_type_name: it.ticket_type_name || "",
                ticket_type_uuid: it.ticket_type_uuid || "",
                quantity: qty,
                single_price: unit,
                item_amount: subtotal,
                item_vat_base: base,
                item_vat: vat,
                item_harbor_fee: port,
            });

            // Terminal-level "auto-validate at sale" flag — if true, every issued
            // ticket is marked validated immediately (typical for mobile/MOBIL POS).
            const autoValidate = Boolean(bd.auto_validate);
            for (let i = 0; i < qty; i++) {
                // Ako je POS poslao ticket-e, povuci po redu (qty se rasipa po jedinicama).
                const ct = clientTicketsByOrder[clientTicketIdx++];
                const ticket_uuid = ct?.ticket_uuid || crypto.randomUUID();
                const fallback_qr = [
                    ticket_uuid,
                    r.line_code || "",
                    r.departure_harbor_name || "",
                    r.arrival_harbor_name || "",
                    r.departure_planned || "",
                    r.route_uuid || "",
                    it.ticket_type_uuid || "",
                ].join(";");
                const ticket_qr = ct?.ticket_qr || fallback_qr;
                ticketsToAdd.push({
                    ticket_uuid,
                    // Veza na račun — kanal prodaje i sredstvo plaćanja stoje
                    // ondje, pa se bez nje po njima ne može filtrirati.
                    invoice_uuid,
                    ticket_code: ct?.ticket_code || randomCode(),
                    order_uuid,
                    order_number: `POS-${invoice_no}`,
                    ticket_group_uuid: it.ticket_type_uuid || null,
                    ticket_type_uuid: it.ticket_type_uuid || null,
                    ticket_type_name: it.ticket_type_name || "",
                    single_price: unit,
                    is_active: true,
                    is_canceled: false,
                    route_uuid: r.route_uuid || null,
                    departure_planed: r.departure_planned || null,
                    departure: r.departure_planned || null,
                    line_code: r.line_code || null,
                    line_name: r.line_name || null,
                    departure_harbor_id: r.departure_harbor_id || null,
                    departure_harbor_name: r.departure_harbor_name || null,
                    arrival_planed: r.arrival_planned || null,
                    arrival: r.arrival_planned || null,
                    arrival_harbor_id: r.arrival_harbor_id || null,
                    arrival_harbor_name: r.arrival_harbor_name || null,
                    deactivate: false,
                    status: autoValidate ? "validated" : "created",
                    validate_data: autoValidate ? new Date() : null,
                    ticket_qr,
                    // Otočna karta — SEOP metadata za ispis na karti i kasniju
                    // dojavu prodaje SEOP-u pri uvođenju produkcijskog flow-a.
                    is_island: it.is_island === true,
                    seop_card_no: it.seop_card_no || null,
                    seop_pravo: it.seop_pravo || null,
                    seop_otok: it.seop_otok || null,
                    seop_discount_pct: it.seop_discount_pct ?? null,
                });
            }
        }

        // --- Promjena karte: priznati iznos sa stare karte ---
        //
        // Račun pokazuje novu kartu punom cijenom i zasebnu stavku umanjenja, pa
        // je ukupno točno ono što putnik doplaćuje (ili dobiva natrag). Da je
        // umjesto toga snižena cijena karte, na računu se ne bi vidjelo da je
        // riječ o promjeni, ni koliko je priznato.
        //
        // Umanjenje se dijeli na osnovicu, PDV i lučku pristojbu istim ključem
        // kao i prodaja — inače se te tri stavke ne bi zbrajale u ukupno.
        const credit = req.body?.transfer_credit;
        const creditAmount = +(Number(credit?.amount) || 0).toFixed(2);
        if (creditAmount > 0) {
            const { port, base, vat } = splitAmount(creditAmount);
            total_amount -= creditAmount;
            total_vat_base -= base;
            total_vat -= vat;
            total_harbor_tax -= port;

            const creditItemUuid = crypto.randomUUID();
            const oznaka = credit?.percentage != null ? ` (${credit.percentage}%)` : "";
            const izvor = Array.isArray(credit?.source_ticket_codes) && credit.source_ticket_codes.length
                ? ` — karta ${credit.source_ticket_codes.join(", ")}`
                : "";
            invoiceItemsToAdd.push({
                item_uuid: creditItemUuid,
                invoice_uuid,
                route_uuid: "",
                line_code: "",
                line_name: "",
                departure: "",
                departure_harbor_id: "",
                departure_harbor_name: "",
                arrival: "",
                arrival_harbor_id: "",
                arrival_harbor_name: "",
                item_amount: -creditAmount,
                item_vat_base: -base,
                item_vat: -vat,
                item_harbor_fee: -port,
            });
            invoiceItemDetailsToAdd.push({
                item_details_uuid: crypto.randomUUID(),
                item_uuid: creditItemUuid,
                ticket_type_name: `Priznato s prethodne karte${oznaka}${izvor}`,
                ticket_type_uuid: "",
                quantity: 1,
                single_price: -creditAmount,
                item_amount: -creditAmount,
                item_vat_base: -base,
                item_vat: -vat,
                item_harbor_fee: -port,
            });
        }

        total_amount = +total_amount.toFixed(2);
        total_vat_base = +total_vat_base.toFixed(2);
        total_vat = +total_vat.toFixed(2);
        total_harbor_tax = +total_harbor_tax.toFixed(2);

        await InvoiceModel.create({
            invoice_uuid,
            invoice_no,
            invoice_fiskal_no,
            invoice_code,
            invoice_year,
            invoice_date: invoiceDate,
            invoice_is_pay: true,
            invoice_payment_method_uuid: pm.uuid,
            invoice_payment_method_name: pm.name,
            invoice_payment_method_fiscal_mark: pm.payment_type_acr || null,
            invoice_payment_data: payment_data,
            // Company (issuer) snapshot
            company_name: company.name || null,
            company_address: company.address || null,
            company_postal_code: company.postal_code || null,
            company_town: company.town || null,
            company_id: company.legal_id || null,
            company_vatid: company.vat_id || null,
            // BP + BD
            invoice_business_premise_uuid: bp.uuid || null,
            invoice_business_premise_name: bp.name || null,
            invoice_business_premise_fiscal_mark: bp.fiskal_mark || null,
            invoice_billing_device_uuid: bd.uuid || null,
            invoice_billing_device_fiscal_mark: bd.fiscal_mark || null,
            // Operator
            operater_uuid: operator.uuid || null,
            operater_name: operator.name || operator.username || null,
            operator_mark: operator.mark || null,
            invoice_operator_name: operator.name || operator.username || "POS",
            // Buyer
            buyer_name: buyer.buyer_name || null,
            buyer_email: buyer.buyer_email || null,
            buyer_tel: buyer.buyer_tel || null,
            buyer_company_name: buyer.buyer_company_name || null,
            buyer_address: buyer.buyer_address || null,
            buyer_oib: buyer.buyer_oib || buyer.buyer_vat_id || null,
            buyer_postal_code: buyer.buyer_postal_code || null,
            buyer_town: buyer.buyer_town || null,
            buyer_country: buyer.buyer_country || null,
            // Totals
            invoice_amount: total_amount,
            invoice_vat_base: total_vat_base,
            invoice_vat: total_vat,
            invoice_harbor_tax: total_harbor_tax,
            order_uuid,
            language: "hr",
            invoice_status: "paid",
            invoice_canceled: false,
            fiskal_required: fiskalRequired,
        });
        await InvoiceItemsModel.bulkCreate(invoiceItemsToAdd);
        await InvoiceItemDetailsModel.bulkCreate(invoiceItemDetailsToAdd);
        await TicketsModel.bulkCreate(ticketsToAdd);

        // F2 fiskalizacija — async (fire-and-forget nakon što invoice postoji).
        // Ne blokira response jer POS-u je bitno samo da račun postoji; YesCor
        // response dolazi kasnije preko polling / changes endpointa.
        let yescorPreview = null;
        if (fiskalRequired) {
            try {
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
                    operator: {
                        mark: operator.mark || null,
                        oib: operator.oib || null,
                    },
                    buyer,
                    paymentMeans: (pm.payment_type_acr === "CARD" ? "48"
                        : pm.payment_type_acr === "TRANSFER" ? "30" : "10"),
                });
                const data = result.response?.data;
                const yescorDocId = typeof data === "string" ? data : data?.data;
                await InvoiceModel.update(
                    {
                        yescor_document_id: yescorDocId || null,
                        yescor_status: result.response?.status >= 200 && result.response?.status < 300
                            ? "submitted"
                            : "failed",
                        yescor_last_sync_at: new Date(),
                        yescor_raw_response: data || null,
                    },
                    { where: { invoice_uuid } }
                );
                yescorPreview = {
                    http_status: result.response?.status,
                    document_id: yescorDocId || null,
                    validation_errors: data?.error?.validationErrors || null,
                };
            } catch (yescorErr) {
                console.log("YesCor submit failed for invoice", invoice_uuid, yescorErr?.message || yescorErr);
                try {
                    await InvoiceModel.update(
                        {
                            yescor_status: "failed",
                            yescor_error_message: yescorErr?.message || String(yescorErr),
                            yescor_last_sync_at: new Date(),
                        },
                        { where: { invoice_uuid } }
                    );
                } catch (_) { /* ignore */ }
                yescorPreview = { error: yescorErr?.message || String(yescorErr) };
            }
        }

        // Nove karte na polasku vidi i drugi uredaj koji ga validira: bez ovoga
        // bi ih ondje nedostajalo dok se popis ne osvjezi rucno, pa bi putnika
        // s valjanom kartom odbio kao nepoznatog.
        try {
            await podigniSignal({
                SyncSignalsModel: req.app.locals.models.SyncSignalsModel,
                kind: "tickets",
                event: `prodaja ${invoice_code || invoice_uuid}`,
            });
        } catch (e) {
            console.log("signal za prodaju nije zapisan:", e?.message || e);
        }

        res.status(200).json({
            status: 200,
            data: {
                invoice_uuid,
                invoice_no,
                invoice_fiskal_no,
                invoice_year,
                invoice_code,
                is_f2: fiskalRequired,
                order_uuid,
                total_amount,
                total_vat_base,
                total_vat,
                total_harbor_tax,
                payment_method_name: pm.name,
                tickets_count: ticketsToAdd.length,
                fiskal_required: fiskalRequired,
                yescor: yescorPreview,
                auto_validated: Boolean(bd.auto_validate),
                tickets: ticketsToAdd.map((t) => ({
                    ticket_uuid: t.ticket_uuid,
                    ticket_code: t.ticket_code,
                    ticket_qr: t.ticket_qr,
                    order_uuid: t.order_uuid,
                    ticket_type_uuid: t.ticket_type_uuid,
                    ticket_type_name: t.ticket_type_name,
                    line_code: t.line_code,
                    line_name: t.line_name,
                    route_uuid: t.route_uuid,
                    departure_harbor_id: t.departure_harbor_id,
                    departure_harbor_name: t.departure_harbor_name,
                    arrival_harbor_id: t.arrival_harbor_id,
                    arrival_harbor_name: t.arrival_harbor_name,
                    departure_planed: t.departure_planed,
                    single_price: t.single_price,
                    status: t.status,
                    validate_data: t.validate_data,
                    is_island: t.is_island,
                    seop_card_no: t.seop_card_no,
                    seop_pravo: t.seop_pravo,
                    seop_otok: t.seop_otok,
                    seop_discount_pct: t.seop_discount_pct,
                })),
            },
        });
    } catch (error) {
        console.log("finalizeTerminalSaleController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { finalizeTerminalSaleController };
