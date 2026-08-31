const crypto = require("crypto");
const axios = require("axios");
const { Op } = require("sequelize");

const { getSequelize } = require("../../config/database");
const { getModels } = require("../../dbModels");
const { getCoreServiceConfigData } = require("../configSyncController");
// Osnovica i provizija po istom pravilu kao u obračunu provizije: izvještaj koji
// partner dobije i račun koji mu izdamo moraju pokazivati isti iznos.
const { neto, provizijaOd } = require("../../helpers/provizija");
// Dinamika naplate je ista ona po kojoj se rade izvjestaji za proviziju —
// racun i izvjestaj moraju pokrivati isto razdoblje.
const { razdobljePoDinamici } = require("./partnerCommissionController");

// Granice razdoblja su datumi (YYYY-MM-DD); pretvaraju se u pocetak odnosno
// kraj tog dana po lokalnom vremenu, jednako kao u obracunu provizije.
const pocetakDanaRazdoblja = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "").trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0) : null;
};
const krajRazdoblja = (v) => {
    const d = pocetakDanaRazdoblja(v);
    if (d) d.setHours(23, 59, 59, 999);
    return d;
};

async function fetchPartnersFromBackoffice() {
    const coreConfig = await getCoreServiceConfigData();
    const boUrl = coreConfig?.services?.backoffice?.url;
    if (!boUrl) throw new Error("backoffice service URL missing from core config");
    const resp = await axios.get(`${boUrl}/partners`, { timeout: 10000 });
    return resp.data?.data?.partners || [];
}

// Podaci izdavatelja. Racun ih nosi kao snimku: podaci tvrtke se s vremenom
// mijenjaju, a vec izdani racun se ne smije mijenjati zajedno s njima.
async function fetchCompanyFromBackoffice() {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const boUrl = coreConfig?.services?.backoffice?.url;
        if (!boUrl) return {};
        const resp = await axios.get(`${boUrl}/company`, { timeout: 10000, validateStatus: () => true });
        return resp.data?.data?.company || {};
    } catch (err) {
        console.log("fetchCompanyFromBackoffice error:", err?.message || err);
        return {};
    }
}

// Postavke izdavanja za kanal "partner" (Administracija → Partnerska prodaja).
// Nose fiskalne oznake i sredstvo plaćanja; provizija i dinamika ostaju po partneru.
async function fetchPartnerChannelSettings() {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const boUrl = coreConfig?.services?.backoffice?.url;
        if (!boUrl) return {};
        const resp = await axios.get(`${boUrl}/channel_settings/partner`, {
            timeout: 10000,
            validateStatus: () => true,
        });
        const cs = resp.data?.data?.channel_settings;
        return cs && cs.is_active ? cs : {};
    } catch (err) {
        console.log("fetchPartnerChannelSettings error:", err?.message || err);
        return {};
    }
}

// Oznaka F2 racuna. Alfabet bez 0/O/1/I — kod se cita s papira i prepisuje
// rukom; isti generator kao na blagajni i mobilnoj, da F2 kodovi izgledaju isto
// bez obzira gdje je racun izdan.
const ALPHA32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomInvoiceCodeF2 = () => {
    let s = "";
    for (let i = 0; i < 8; i++) s += ALPHA32[crypto.randomInt(0, ALPHA32.length)];
    return s;
};

// F1 nosi strukturu fiskalni_broj/poslovni_prostor/naplatni_uredaj; F2 je
// nema, pa mu vidljiva oznaka racuna postaje njegov kod.
const buildInvoiceCode = (isF2, fiskalNo, bpMark, bdMark) =>
    isF2 ? randomInvoiceCodeF2() : ((fiskalNo && bpMark && bdMark) ? `${fiskalNo}/${bpMark}/${bdMark}` : null);

async function generatePartnerInvoices({ asOfDate, onlyPartnerUuid } = {}) {
    const now = asOfDate ? new Date(asOfDate) : new Date();
    const currentYear = now.getFullYear();

    const { TicketsModel, PartnerInvoiceModel, PartnerInvoiceItemModel } = getModels();
    const sequelize = getSequelize();

    const partners = await fetchPartnersFromBackoffice();
    const channel = await fetchPartnerChannelSettings();
    const company = await fetchCompanyFromBackoffice();
    const partnersToProcess = onlyPartnerUuid
        ? partners.filter((p) => p.uuid === onlyPartnerUuid)
        : partners.filter((p) => p.is_active);

    const result = {
        processed_at: now.toISOString(),
        invoices: [],
        partners_skipped: [],
    };

    // Sekvenca ide po godini i naplatnom uredaju, kao i na blagajni: jedan
    // uredaj — jedan niz, bez obzira kojem partneru racun ide.
    const uredaj = channel.billing_device_uuid || null;
    const zaUredaj = { invoice_year: currentYear, billing_device_uuid: uredaj };
    const maxRow = await PartnerInvoiceModel.findOne({
        where: zaUredaj,
        order: [["partner_invoice_no", "DESC"]],
    });
    let nextNo = (maxRow?.partner_invoice_no || 0) + 1;
    // F2 ne trosi fiskalnu sekvencu, pa se ona vodi zasebno.
    const maxFiskal = await PartnerInvoiceModel.max("partner_invoice_fiskal_no", { where: zaUredaj });
    let nextFiskalNo = (Number.isFinite(maxFiskal) ? maxFiskal : 0) + 1;

    for (const partner of partnersToProcess) {
        // Razdoblje dolazi iz dinamike na partneru, ne iz trenutka pokretanja.
        // razdobljePoDinamici vraca zadnje ZATVORENO razdoblje, pa se racun radi
        // tek kad razdoblje prode — kod MONTHLY prvog u mjesecu za prethodni.
        const razdoblje = razdobljePoDinamici(partner, now, false);
        const granica = krajRazdoblja(razdoblje.to);
        const oznakaRazdoblja = `${razdoblje.from} – ${razdoblje.to}`;

        // Isto razdoblje se ne fakturira dvaput. Bez ove provjere bi svaki
        // prolaz ponovno izdao racun cim se pojavi ijedna neobracunata karta.
        const vecPostoji = await PartnerInvoiceModel.findOne({
            where: {
                partner_uuid: partner.uuid,
                period_to: granica,
            },
        });
        if (vecPostoji) {
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: `vec fakturirano za ${oznakaRazdoblja}`,
            });
            continue;
        }

        // Sve neobracunato zakljucno s krajem razdoblja. Granica je datum
        // prodaje, a ne trenutak prolaza: prodaja nastala izmedu ponoci i
        // pokretanja pada u sljedece razdoblje. Karte zaostale iz ranijih
        // razdoblja se pokupe ovdje, da ne ostanu vjecno nefakturirane.
        const tickets = await TicketsModel.findAll({
            where: {
                partner_uuid: partner.uuid,
                partner_invoice_uuid: null,
                [Op.or]: [{ is_canceled: false }, { is_canceled: null }],
                createdAt: { [Op.lte]: granica },
            },
            order: [["createdAt", "ASC"]],
        });

        if (!tickets.length) {
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: `nema neobracunatih karata u razdoblju ${oznakaRazdoblja}`,
            });
            continue;
        }

        const commissionPct = parseFloat(partner.commission_pct) || 0;
        const vatRate = parseFloat(partner.vat_rate) || 0;
        // Fiskalizira se ako to traži partner ili ako je uključeno na kanalu.
        const fiskalRequired = Boolean(partner.f2_required) || channel.fiskal_required === true;

        let gross = 0;
        let commissionBase = 0;
        let harborTax = 0;
        const ticketItems = tickets.map((t) => {
            const g = parseFloat(t.single_price) || 0;
            const i = neto(g);
            gross += g;
            commissionBase += i.osnovica;
            harborTax += i.pristojba;
            return { ticket: t, gross: g, base: i.osnovica, harborTax: i.pristojba };
        });
        gross = +gross.toFixed(2);
        // Lučka pristojba se partneru fakturira u cijelosti i ne umanjuje se za
        // proviziju: nije naš prihod nego se prosljeđuje luci, pa na njoj nema
        // sto dijeliti. Stoji izdvojeno da se na racunu vidi koliko je od
        // naplacenog iznosa tuda stavka.
        harborTax = +harborTax.toFixed(2);
        // Provizija ide na osnovicu — bez lučke pristojbe i bez PDV-a. Prije se
        // računala na naplaćeni iznos, pa je partneru išlo i na tuđi novac:
        // pristojba je prolazna stavka, PDV je državin.
        commissionBase = +commissionBase.toFixed(2);
        const commissionAmount = provizijaOd(commissionBase, commissionPct);

        // Račun se slaže ovako: osnovica umanjena za proviziju je ono što nam
        // partner duguje od vožnje, na to ide PDV, a lučka pristojba se dodaje
        // cijela i bez PDV-a — prolazna je stavka i nije predmet oporezivanja.
        // Prije se PDV vadio iz cijelog naplaćenog iznosa, pa se obračunavao i
        // na proviziju i na pristojbu.
        const vatBase = +(commissionBase - commissionAmount).toFixed(2);
        const vatAmount = vatRate > 0 ? +((vatBase * vatRate) / 100).toFixed(2) : 0;
        const netAmount = +(vatBase + vatAmount + harborTax).toFixed(2);

        // Stavka nosi svoj udio u osnovici za PDV: cijena karte bez pristojbe i
        // bez PDV-a, umanjena za proviziju. PDV se ne razbija po karti nego ide
        // na zbroj — zaokruživanje po karti bi odstupilo od iznosa računa.
        const items = ticketItems.map(({ ticket, gross: g, base, harborTax: hp }) => {
            const itemCommission = provizijaOd(base, commissionPct);
            return { ticket, gross: g, base, harborTax: hp, commission: itemCommission, net: +(base - itemCommission).toFixed(2) };
        });
        // Zbroj stavaka mora dati iznos u zaglavlju: provizija se računa na
        // zbroj osnovice, pa se ostatak zaokruživanja pripisuje zadnjoj stavci —
        // inače račun ne štima sam sa sobom.
        if (items.length) {
            const zbrojStavaka = +items.reduce((z, s) => z + s.commission, 0).toFixed(2);
            const razlika = +(commissionAmount - zbrojStavaka).toFixed(2);
            if (razlika !== 0) {
                const zadnja = items[items.length - 1];
                zadnja.commission = +(zadnja.commission + razlika).toFixed(2);
            }
            const zadnja = items[items.length - 1];
            zadnja.net = +(zadnja.base - zadnja.commission).toFixed(2);
        }

        // Pocetak razdoblja se rasteze unatrag ako su pokupljene zaostale karte
        // iz ranijih razdoblja — inace bi racun tvrdio da pokriva uze razdoblje
        // nego sto stvarno pokriva.
        const prvaKarta = tickets[0].createdAt;
        const pocetakRazdoblja = pocetakDanaRazdoblja(razdoblje.from);
        const periodFrom = prvaKarta < pocetakRazdoblja ? prvaKarta : pocetakRazdoblja;
        const periodTo = granica;

        const invoiceUuid = crypto.randomUUID();
        const invoiceNo = nextNo;
        // F2 dobiva svoj kod i ne uzima fiskalni broj; F1 nastavlja fiskalni niz.
        const invoiceFiskalNo = fiskalRequired ? null : nextFiskalNo;
        const invoiceCode = buildInvoiceCode(
            fiskalRequired,
            invoiceFiskalNo,
            channel.business_premise_fiscal_mark,
            channel.billing_device_fiscal_mark
        );

        const tx = await sequelize.transaction();
        try {
            await PartnerInvoiceModel.create(
                {
                    partner_invoice_uuid: invoiceUuid,
                    partner_invoice_no: invoiceNo,
                    partner_invoice_fiskal_no: invoiceFiskalNo,
                    partner_invoice_code: invoiceCode,
                    is_f2: fiskalRequired,
                    invoice_year: currentYear,
                    invoice_date: now,
                    period_from: periodFrom,
                    period_to: periodTo,
                    company_name: company.name || null,
                    company_address: company.address || null,
                    company_postal_code: company.postal_code || null,
                    company_town: company.town || null,
                    company_legal_id: company.legal_id || null,
                    company_iban: company.iban || null,
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
                    commission_base: commissionBase,
                    harbor_tax_amount: harborTax,
                    commission_amount: commissionAmount,
                    net_amount: netAmount,
                    vat_rate: vatRate,
                    vat_base: vatBase,
                    vat_amount: vatAmount,
                    status: "issued",
                    business_premise_uuid: channel.business_premise_uuid || null,
                    business_premise_name: channel.business_premise_name || null,
                    business_premise_fiscal_mark: channel.business_premise_fiscal_mark || null,
                    billing_device_uuid: channel.billing_device_uuid || null,
                    billing_device_fiscal_mark: channel.billing_device_fiscal_mark || null,
                    payment_method_uuid: channel.payment_method_uuid || null,
                    payment_method_name: channel.payment_method_name || null,
                    cost_center: channel.cost_center || null,
                    fiskal_required: fiskalRequired,
                },
                { transaction: tx }
            );

            const itemsPayload = items.map(({ ticket, gross: g, base, harborTax: hp, commission, net }) => ({
                partner_invoice_uuid: invoiceUuid,
                ticket_uuid: ticket.ticket_uuid,
                order_uuid: ticket.order_uuid,
                order_note: ticket.order_note,
                sale_datetime: ticket.createdAt,
                sold_by_username: ticket.sold_by_username,
                ticket_code: ticket.ticket_code,
                ticket_type_name: ticket.ticket_type_name,
                route_uuid: ticket.route_uuid,
                line_code: ticket.line_code,
                line_name: ticket.line_name,
                departure_harbor_name: ticket.departure_harbor_name,
                arrival_harbor_name: ticket.arrival_harbor_name,
                departure: ticket.departure,
                gross_amount: g,
                commission_base: base,
                harbor_tax_amount: hp,
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
            if (!fiskalRequired) nextFiskalNo += 1;

            result.invoices.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                partner_invoice_uuid: invoiceUuid,
                partner_invoice_no: invoiceNo,
                partner_invoice_fiskal_no: invoiceFiskalNo,
                partner_invoice_code: invoiceCode,
                is_f2: fiskalRequired,
                tickets_count: tickets.length,
                gross_amount: gross,
                commission_pct: commissionPct,
                commission_base: commissionBase,
                harbor_tax_amount: harborTax,
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
