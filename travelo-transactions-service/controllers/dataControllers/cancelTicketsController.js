const crypto = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");
const { releaseBookings } = require("../../helpers/bookingClient");
const { dodajStavku } = require("./paymentOrderControllers");
const { provjeriIban } = require("../../helpers/iban");

// Opis povrata završi u platnom nalogu i vidi ga primatelj na izvatku, pa je
// ispravan padež mjesto gdje se ne štedi.
const rijecKarte = (n) => {
    const zadnjeDvije = n % 100;
    const zadnja = n % 10;
    if (zadnjeDvije >= 11 && zadnjeDvije <= 14) return "karata";
    if (zadnja === 1) return "karta";
    if (zadnja >= 2 && zadnja <= 4) return "karte";
    return "karata";
};

// Match legacy split: port tax 6%, VAT 25% on the rest.
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

const nextInvoiceFiskalNo = async (InvoiceModel, year, billingDeviceUuid) => {
    const max = await InvoiceModel.max("invoice_fiskal_no", {
        where: { invoice_year: year, invoice_billing_device_uuid: billingDeviceUuid },
    });
    return Number.isFinite(max) ? max + 1 : 1;
};

// Baza je na udaljenom clusteru, pa /company zna trajati i preko sekunde, a
// pod opterećenjem i dulje. S 5 sekundi je storno padao na isteku veze nakon
// što je operater sve unio — 20 je dovoljno da se to ne događa, a i dalje ne
// ostavlja zahtjev da visi.
const BACKOFFICE_TIMEOUT = 20000;

const dohvati = async (url) => {
    try {
        return await axios.get(url, { timeout: BACKOFFICE_TIMEOUT, validateStatus: () => true });
    } catch (error) {
        // Sirova poruka ("timeout of 5000ms exceeded") operateru ne znači ništa,
        // a važno je da zna da nije storniran ni jedan račun.
        throw new Error("backoffice ne odgovara — storno nije izvršen, pokušaj ponovno");
    }
};

const loadStornoContext = async (terminalUuid) => {
    const coreConfig = await getCoreServiceConfigData();
    const backofficeUrl = coreConfig?.services?.backoffice?.url;
    if (!backofficeUrl) throw new Error("backoffice URL missing in core config");

    const [companyResp, bpResp, bdResp, pmResp] = await Promise.all([
        dohvati(`${backofficeUrl}/company`),
        dohvati(`${backofficeUrl}/business_premises`),
        dohvati(`${backofficeUrl}/billing_devices`),
        dohvati(`${backofficeUrl}/payment_methods`),
    ]);

    const company = companyResp.data?.data?.company || {};
    const bps = bpResp.data?.data?.business_premises || [];
    const bds = bdResp.data?.data?.billing_devices || [];
    // Sredstvo plaćanja na uređaju ne nosi `card_provider` — nosi ga samo
    // šifarnik, pa se provider čita odande, po nazivu sredstva.
    const pmList = pmResp.data?.data?.payment_methods
        || (Array.isArray(pmResp.data?.data) ? pmResp.data.data : []);
    const bd = bds.find((x) => x.uuid === terminalUuid);
    if (!bd) throw new Error(`billing device ${terminalUuid} not found`);
    const bp = bps.find((x) => x.uuid === bd.business_premise_uuid) || {};
    return { company, businessPremise: bp, billingDevice: bd, paymentMethods: pmList };
};

const cancelTicketsController = async (req, res) => {
    const models = req.app.locals.models;
    const { TicketsModel, InvoiceModel, InvoiceItemsModel, InvoiceItemDetailsModel } = models;
    try {
        const {
            ticket_uuids,
            terminal_uuid,
            payment_method_uuid,
            percentage,
            // Client-provided storno identifikatori — POS je autoritativan, backend
            // samo zapisuje 1:1. Fallback generacija ostaje za legacy pozivatelje.
            storno_invoice_uuid: client_invoice_uuid,
            storno_invoice_no: client_invoice_no,
            storno_invoice_year: client_invoice_year,
            storno_invoice_fiskal_no: client_invoice_fiskal_no,
            storno_invoice_code: client_invoice_code,
            storno_is_f2: client_is_f2,
            // Povrat u platni nalog: { payment_order_uuid } uz, za SEPA nalog,
            // primatelja i IBAN. Kartični povrat ne traži ništa — podaci o
            // izvornoj transakciji čitaju se s računa kojim je karta plaćena.
            // Bez ovog bloka je povrat samo po odabranom sredstvu, kao i dosad.
            refund,
        } = req.body || {};

        if (!Array.isArray(ticket_uuids) || !ticket_uuids.length) {
            return res.status(400).json({ status: 400, data: { message: "ticket_uuids required" } });
        }
        if (!terminal_uuid) {
            return res.status(400).json({ status: 400, data: { message: "terminal_uuid required" } });
        }
        if (!payment_method_uuid) {
            return res.status(400).json({ status: 400, data: { message: "payment_method_uuid required" } });
        }
        const pct = Math.max(0, Math.min(100, parseFloat(percentage) || 0));
        if (pct <= 0) {
            return res.status(400).json({ status: 400, data: { message: "percentage must be > 0" } });
        }

        // Nalog se provjerava prije nego što se išta zapiše. Storno je izdavanje
        // računa i ne poništava se, pa nalog mora biti ispravan prije nego krene —
        // inače bi karta ostala stornirana bez traga povrata.
        let nalogPovrata = null;
        if (refund) {
            const { PaymentOrderModel } = models;
            nalogPovrata = await PaymentOrderModel.findOne({
                where: { payment_order_uuid: refund.payment_order_uuid },
            });
            if (!nalogPovrata) {
                return res.status(400).json({ status: 400, data: { message: "platni nalog ne postoji" } });
            }
            if (nalogPovrata.status !== "open") {
                return res.status(400).json({ status: 400, data: { message: "platni nalog je zatvoren" } });
            }
            if (String(nalogPovrata.provider).toUpperCase() === "SEPA") {
                if (!String(refund.recipient_name || "").trim()) {
                    return res.status(400).json({ status: 400, data: { message: "naziv primatelja je obavezan" } });
                }
                const provjera = provjeriIban(refund.recipient_iban);
                if (!provjera.ok) {
                    return res.status(400).json({ status: 400, data: { message: `IBAN nije ispravan — ${provjera.razlog}` } });
                }
            }
        }

        const tickets = await TicketsModel.findAll({ where: { ticket_uuid: { [Op.in]: ticket_uuids } } });
        // Broje se različiti uuid-i, ne redci. Zatečene dvostruke karte — ista
        // prodaja zapisana dvaput jer je terminal ponovio slanje — inače su
        // rušile storno porukom "only 2/1 tickets found", iako je karta uredno
        // nađena. Storniraju se svi redci te karte.
        const nadjeni = new Set(tickets.map((t) => t.ticket_uuid));
        if (nadjeni.size !== ticket_uuids.length) {
            return res.status(404).json({
                status: 404,
                data: { message: `only ${nadjeni.size}/${ticket_uuids.length} tickets found` },
            });
        }
        // Novac se računa po karti, a ne po zatečenom retku: dvostruko zapisana
        // karta inače daje dvostruki povrat. Označavanje storniranim ide na sve
        // retke te karte, da nijedan ne ostane važeći.
        const karteZaPovrat = [];
        const vidjeni = new Set();
        for (const t of tickets) {
            if (vidjeni.has(t.ticket_uuid)) continue;
            vidjeni.add(t.ticket_uuid);
            karteZaPovrat.push(t);
        }
        // Karta otkazanog putovanja nosi `is_canceled`, ali NIJE stornirana —
        // putnik nije dobio novac natrag. Njoj storno tek treba, pa se ovdje
        // odbijaju samo one koje su stvarno već stornirane ili prebačene na
        // drugi polazak.
        const nemaSeStoScornirati = tickets.filter((t) => {
            const s = String(t.status || "").toLowerCase();
            if (s === "trip_canceled") return false;
            return t.is_canceled === true || s === "canceled" || s === "transferred";
        });
        if (nemaSeStoScornirati.length) {
            return res.status(409).json({
                status: 409,
                data: {
                    message: "some tickets already canceled",
                    canceled_ticket_codes: nemaSeStoScornirati.map((t) => t.ticket_code),
                },
            });
        }

        const { company, businessPremise: bp, billingDevice: bd, paymentMethods } = await loadStornoContext(terminal_uuid);
        const pmList = bd.payment || bd.payment_methods || [];
        const pm = pmList.find((x) => x.uuid === payment_method_uuid);
        if (!pm) {
            return res.status(400).json({
                status: 400,
                data: { message: "payment method does not belong to selected terminal" },
            });
        }
        // Nalog mora odgovarati sredstvu kojim se povrat provodi:
        //   SEPA        → transakcijski račun (fiskalna oznaka "T")
        //   kartični    → kartično sredstvo istog providera kao nalog
        // Inače bi povrat završio u nalogu koji ide krivom primatelju, ili bi
        // se gotovinski povrat (već isplaćen na blagajni) vodio i kao nalog.
        if (nalogPovrata) {
            const provider = String(nalogPovrata.provider).toUpperCase();
            const oznaka = String(pm.payment_type_acr || "").toUpperCase();
            if (provider === "SEPA" && oznaka !== "T") {
                return res.status(400).json({
                    status: 400,
                    data: { message: "povrat na IBAN je moguć samo uz sredstvo plaćanja s fiskalnom oznakom T" },
                });
            }
            if (provider !== "SEPA") {
                const izSifarnika = (paymentMethods || []).find((x) => x.name === pm.name);
                const pmProvider = String(pm.card_provider || izSifarnika?.card_provider || "").toUpperCase();
                if (oznaka !== "K") {
                    return res.status(400).json({
                        status: 400,
                        data: { message: "povrat na karticu je moguć samo uz kartično sredstvo plaćanja" },
                    });
                }
                if (pmProvider && pmProvider !== provider) {
                    return res.status(400).json({
                        status: 400,
                        data: { message: `nalog je za ${provider}, a sredstvo plaćanja je ${pmProvider}` },
                    });
                }
            }
        }

        const invoiceDate = new Date();
        const invoice_uuid = client_invoice_uuid || crypto.randomUUID();
        const invoice_year = client_invoice_year || invoiceDate.getFullYear();
        const invoice_no = client_invoice_no
            || (await nextInvoiceNo(InvoiceModel, invoice_year, bd.uuid));
        const isF2 = Boolean(client_is_f2);
        const invoice_fiskal_no = client_invoice_fiskal_no != null
            ? client_invoice_fiskal_no
            : (isF2 ? null : await nextInvoiceFiskalNo(InvoiceModel, invoice_year, bd.uuid));

        let total_amount = 0;
        let total_vat_base = 0;
        let total_vat = 0;
        let total_harbor_tax = 0;

        const invoiceItemsToAdd = [];
        const invoiceItemDetailsToAdd = [];

        // One invoice_item per ticket (refund line). Amount is negative = refund.
        for (const t of karteZaPovrat) {
            const refundPos = +(Number(t.single_price || 0) * (pct / 100)).toFixed(2);
            const refund = -refundPos;
            const { port, base, vat } = splitAmount(refund);

            total_amount += refund;
            total_vat_base += base;
            total_vat += vat;
            total_harbor_tax += port;

            const itemUuid = crypto.randomUUID();
            invoiceItemsToAdd.push({
                item_uuid: itemUuid,
                invoice_uuid,
                route_uuid: t.route_uuid || "",
                line_code: t.line_code || "",
                line_name: t.line_name || "",
                departure: t.departure || "",
                departure_harbor_id: t.departure_harbor_id || "",
                departure_harbor_name: t.departure_harbor_name || "",
                arrival: t.arrival || "",
                arrival_harbor_id: t.arrival_harbor_id || "",
                arrival_harbor_name: t.arrival_harbor_name || "",
                item_amount: refund,
                item_vat_base: base,
                item_vat: vat,
                item_harbor_fee: port,
            });
            invoiceItemDetailsToAdd.push({
                item_details_uuid: crypto.randomUUID(),
                item_uuid: itemUuid,
                ticket_type_name: t.ticket_type_name || "",
                ticket_type_uuid: t.ticket_type_uuid || "",
                quantity: 1,
                single_price: refund,
                item_amount: refund,
                item_vat_base: base,
                item_vat: vat,
                item_harbor_fee: port,
            });
        }

        total_amount = +total_amount.toFixed(2);
        total_vat_base = +total_vat_base.toFixed(2);
        total_vat = +total_vat.toFixed(2);
        total_harbor_tax = +total_harbor_tax.toFixed(2);

        // F2 storno → POS-ov 8-char invoice_code (preneseno kao client_invoice_code).
        // F1 storno → "STORNO NO/PP/NU". Ako klijent eksplicitno pošalje invoice_code,
        // koristi ga doslovno (ne dodaje "STORNO" prefiks — POS sam gradi format).
        const fallbackStornoCode = bp.fiskal_mark && bd.fiscal_mark && invoice_fiskal_no
            ? `STORNO ${invoice_fiskal_no}/${bp.fiskal_mark}/${bd.fiscal_mark}`
            : "STORNO";
        const finalInvoiceCode = client_invoice_code || fallbackStornoCode;
        await InvoiceModel.create({
            invoice_uuid,
            invoice_no,
            invoice_fiskal_no,
            invoice_code: finalInvoiceCode,
            invoice_year,
            invoice_date: invoiceDate,
            invoice_is_pay: true,
            invoice_payment_method_uuid: pm.uuid,
            invoice_payment_method_name: pm.name,
            invoice_payment_method_fiscal_mark: pm.payment_type_acr || null,
            company_name: company.name || null,
            company_address: company.address || null,
            company_postal_code: company.postal_code || null,
            company_town: company.town || null,
            company_id: company.legal_id || null,
            company_vatid: company.vat_id || null,
            invoice_business_premise_uuid: bp.uuid || null,
            invoice_business_premise_name: bp.name || null,
            invoice_business_premise_fiscal_mark: bp.fiskal_mark || null,
            invoice_billing_device_uuid: bd.uuid || null,
            invoice_billing_device_fiscal_mark: bd.fiscal_mark || null,
            invoice_operator_name: "STORNO",
            invoice_amount: total_amount,
            invoice_vat_base: total_vat_base,
            invoice_vat: total_vat,
            invoice_harbor_tax: total_harbor_tax,
            invoice_status: "canceled",
            invoice_canceled: true,
        });
        await InvoiceItemsModel.bulkCreate(invoiceItemsToAdd);
        await InvoiceItemDetailsModel.bulkCreate(invoiceItemDetailsToAdd);

        const ticketIds = tickets.map((t) => t.id);
        await TicketsModel.update(
            { is_canceled: true, status: "canceled", deactivate: true, deactivate_data: invoiceDate },
            { where: { id: ticketIds } }
        );

        // Release capacity in booking service (per ticket, qty=1 each since ticket rows are singular).
        // Ide po karti, ne po retku — inače bi dvostruko zapisana karta oslobodila
        // dva mjesta, a zauzimala je jedno.
        const releaseItems = karteZaPovrat
            .filter((t) => t.route_uuid && t.ticket_type_uuid)
            .map((t) => ({ route_uuid: t.route_uuid, ticket_type_uuid: t.ticket_type_uuid, qty: 1 }));
        if (releaseItems.length) await releaseBookings(releaseItems);

        // Stavka platnog naloga: jedan povrat po stornu, bez obzira na broj
        // karata — primatelj je jedan i novac ide jednom stavkom. Karte se
        // pamte da se s naloga vidi na što se odnosi.
        let refundItem = null;
        if (nalogPovrata) {
            const provider = String(nalogPovrata.provider).toUpperCase();
            const stavka = {
                payment_order_uuid: nalogPovrata.payment_order_uuid,
                amount: total_amount, // negativan na računu, u nalogu ide kao iznos isplate
                storno_invoice_uuid: invoice_uuid,
                storno_invoice_code: finalInvoiceCode,
                ticket_uuids: karteZaPovrat.map((t) => t.ticket_uuid),
                ticket_codes: karteZaPovrat.map((t) => t.ticket_code).filter(Boolean),
                description: `Povrat po stornu ${finalInvoiceCode} - ${karteZaPovrat.length} ${rijecKarte(karteZaPovrat.length)}`,
                created_by: refund.created_by || null,
            };

            if (provider === "SEPA") {
                stavka.recipient_name = refund.recipient_name;
                stavka.recipient_iban = refund.recipient_iban;
            } else {
                // Kartičarska kuća povrat provodi po izvornoj transakciji, pa se
                // podaci čitaju s računa kojim je karta plaćena — operater ih ne
                // upisuje. Račun se traži po vezi s karte, a kod web prodaje po
                // narudžbi, jer ondje veza na račun zna nedostajati.
                const izvorniUuid = tickets.find((t) => t.invoice_uuid)?.invoice_uuid || null;
                const orderUuid = tickets.find((t) => t.order_uuid)?.order_uuid || null;
                const izvorni = izvorniUuid
                    ? await InvoiceModel.findOne({ where: { invoice_uuid: izvorniUuid } })
                    : (orderUuid
                        ? await InvoiceModel.findOne({ where: { order_uuid: { [Op.like]: `%${orderUuid}%` } } })
                        : null);
                const pd = izvorni?.invoice_payment_data || {};
                stavka.original_invoice_uuid = izvorni?.invoice_uuid || null;
                stavka.original_invoice_no = izvorni ? `${izvorni.invoice_no}/${izvorni.invoice_year}` : null;
                // Nazivi polja se razlikuju po provideru: terminal vraća
                // authCode/tid, Monri approval_code uz vlastitu referencu.
                stavka.card_mask = pd.cardNumber || pd.masked_pan || null;
                stavka.card_type = pd.cardType || pd.card_type || null;
                stavka.auth_code = pd.authCode || pd.approval_code || null;
                stavka.terminal_id = pd.tid || pd.terminal_id || null;
                stavka.transaction_reference = pd.transactionIdentifier || pd.transaction_id || pd.order_number || null;
                stavka.transaction_date = pd.transactionDate || pd.received_at || null;
            }

            const rezultat = await dodajStavku(models, stavka);
            if (rezultat.status !== 200) {
                // Storno je već izdan; povrat se onda evidentira ručno u nalogu.
                console.log("stavka platnog naloga nije zapisana:", rezultat.body?.message);
            } else {
                refundItem = rezultat.body.item;
            }
        }

        res.status(200).json({
            status: 200,
            data: {
                invoice_uuid,
                invoice_no,
                invoice_year,
                invoice_fiskal_no,
                invoice_code: finalInvoiceCode,
                is_f2: isF2,
                total_amount,
                canceled_ticket_uuids: karteZaPovrat.map((t) => t.ticket_uuid),
                refund_item: refundItem,
            },
        });
    } catch (error) {
        console.log("cancelTicketsController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { cancelTicketsController };
