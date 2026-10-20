const { getModels } = require("../../dbModels");
const { Op } = require("sequelize");
const { sendInvoiceToYescor } = require("../integrations/sendInvoiceToYescor");
const { zabiljeziF2Gresku } = require("../../helpers/f2Greske");
const { fiskalizirajRacun, fetchCompanyFromBackoffice } = require("./partnerInvoiceGeneratorController");

// Stanje racuna sada — zapis greske je povijest, a Kontrola treba znati je li
// racun u meduvremenu ipak prosao (ponovno slanje, ili je YesCor proradio).
const dopuniStanjem = async (zapisi) => {
    const { InvoiceModel, PartnerInvoiceModel } = getModels();
    const uuidi = (vrsta) => [...new Set(zapisi.filter((z) => z.vrsta === vrsta && z.invoice_uuid).map((z) => z.invoice_uuid))];
    const polja = ["yescor_status", "yescor_fiscalization_status", "yescor_document_id"];
    const racuni = uuidi("racun").length
        ? await InvoiceModel.findAll({ where: { invoice_uuid: { [Op.in]: uuidi("racun") } }, attributes: ["invoice_uuid", ...polja], raw: true })
        : [];
    const partnerski = uuidi("partnerski").length
        ? await PartnerInvoiceModel.findAll({ where: { partner_invoice_uuid: { [Op.in]: uuidi("partnerski") } }, attributes: ["partner_invoice_uuid", ...polja], raw: true })
        : [];
    const stanje = new Map([
        ...racuni.map((r) => [`racun|${r.invoice_uuid}`, r]),
        ...partnerski.map((r) => [`partnerski|${r.partner_invoice_uuid}`, r]),
    ]);
    return zapisi.map((z) => {
        const r = stanje.get(`${z.vrsta}|${z.invoice_uuid}`);
        return {
            ...z,
            stanje_status: r?.yescor_status ?? null,
            stanje_fiskalizacija: r?.yescor_fiscalization_status ?? null,
            stanje_document_id: r?.yescor_document_id ?? null,
        };
    });
};

// Racun je prosao kad ga YesCor drzi i nije ga odbio — tada se ne salje opet,
// jer bi isti broj racuna otisao dvaput. Fiskaliziran racun je prosao i kad
// dostava kupcu nije uspjela (status 'error', npr. primatelj nema adresu za
// e-racun): ponovno slanje bi ga fiskaliziralo drugi put.
const prosao = (r) => r.yescor_fiscalization_status === "successful"
    || (!!r.yescor_document_id
        && !["failed", "error"].includes(r.yescor_status)
        && r.yescor_fiscalization_status !== "error");

// Popis neuspjelih F2 slanja — Kontrola → „F2 greške". Najnovije prvo; filtri
// po fazi (slanje / fiskalizacija) i rasponu datuma. Brojaci po fazi idu samo
// kad se ne filtrira po fazi, inace ne bi bili tocni za druge kartice.
const listF2ErrorsController = async (req, res) => {
    try {
        const { F2ErrorModel } = getModels();

        const where = {};
        if (req.query.faza) where.faza = String(req.query.faza).trim();

        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        // "Do" je ukljuciv — obuhvati cijeli dan.
        if (to && !isNaN(to)) to.setHours(23, 59, 59, 999);
        if (from && !isNaN(from) && to && !isNaN(to)) {
            where.createdAt = { [Op.between]: [from, to] };
        } else if (from && !isNaN(from)) {
            where.createdAt = { [Op.gte]: from };
        } else if (to && !isNaN(to)) {
            where.createdAt = { [Op.lte]: to };
        }

        const zapisi = await F2ErrorModel.findAll({
            where,
            attributes: { exclude: ["odgovor"] },
            order: [["createdAt", "DESC"]],
            limit: 1000,
            raw: true,
        });
        const errors = await dopuniStanjem(zapisi);

        let counts = {};
        if (!req.query.faza) {
            const svi = await F2ErrorModel.findAll({
                attributes: ["faza"],
                where: where.createdAt ? { createdAt: where.createdAt } : {},
                raw: true,
            });
            counts = svi.reduce((acc, r) => {
                acc[r.faza] = (acc[r.faza] || 0) + 1;
                return acc;
            }, {});
        }

        res.send({ status: 200, data: { errors, counts } });
    } catch (error) {
        console.log("listF2ErrorsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Ponovno slanje racuna u YesCor iz Kontrole. Salje se isti racun (isti broj,
// iste stavke) sastavljen iz onoga sto je spremljeno — izdavatelj iz snimke na
// racunu, dopunjen podacima tvrtke kad snimka nema neko polje.
const posaljiRacunPonovno = async (invoice_uuid) => {
    const { InvoiceModel, InvoiceItemsModel } = getModels();
    const inv = await InvoiceModel.findOne({ where: { invoice_uuid }, raw: true });
    if (!inv) return { http: 404, message: "racun nije naden" };
    if (!inv.fiskal_required && !inv.buyer_oib) return { http: 400, message: "racun nije F2" };
    if (inv.invoice_canceled) return { http: 400, message: "racun je storniran" };
    if (prosao(inv)) return { http: 409, message: "racun je vec poslan u YesCor" };

    const tvrtka = await fetchCompanyFromBackoffice();
    const company = {
        name: inv.company_name || tvrtka.name,
        address: inv.company_address || tvrtka.address,
        postal_code: inv.company_postal_code || tvrtka.postal_code,
        town: inv.company_town || tvrtka.town,
        legal_id: inv.company_id || tvrtka.legal_id,
        vat_id: inv.company_vatid || tvrtka.vat_id,
        email: tvrtka.email || "",
    };
    const items = await InvoiceItemsModel.findAll({ where: { invoice_uuid }, raw: true });
    const oznaka = inv.invoice_payment_method_fiscal_mark;
    const paymentMeans = oznaka === "K" ? "48" : oznaka === "T" ? "30"
        : inv.invoice_operator_name === "WEB PRODAJA" ? "48" : "10";

    try {
        const result = await sendInvoiceToYescor({
            models: getModels(),
            invoice: inv,
            items,
            company,
            operator: { mark: inv.operator_mark || null, oib: company.legal_id },
            buyer: inv,
            paymentMeans,
        });
        const data = result.response?.data;
        const docId = typeof data === "string" ? data : data?.data;
        const ok = result.response?.status >= 200 && result.response?.status < 300;
        if (!ok) {
            await zabiljeziF2Gresku({ izvor: "ponovno", invoice_uuid, http_status: result.response?.status, odgovor: data });
        }
        await InvoiceModel.update({
            yescor_document_id: ok ? (docId || null) : inv.yescor_document_id,
            yescor_status: ok ? "submitted" : "failed",
            yescor_fiscalization_status: ok ? null : inv.yescor_fiscalization_status,
            yescor_error_message: ok ? null : (data?.error?.message || JSON.stringify(data?.error || data || {})).slice(0, 1000),
            yescor_last_sync_at: new Date(),
            yescor_raw_response: data || null,
        }, { where: { invoice_uuid } });
        console.log(`[yescor] ponovno slanje ${inv.invoice_no} → ${ok ? "submitted" : "failed"} (HTTP ${result.response?.status})`);
        return ok
            ? { http: 200, message: "racun je poslan", yescor_document_id: docId || null }
            : { http: 502, message: "YesCor je odbio racun" };
    } catch (err) {
        console.log("[yescor] ponovno slanje nije uspjelo:", err?.message || err);
        await zabiljeziF2Gresku({ izvor: "ponovno", invoice_uuid, greska: err });
        await InvoiceModel.update({
            yescor_status: "failed",
            yescor_error_message: String(err?.message || err).slice(0, 500),
            yescor_last_sync_at: new Date(),
        }, { where: { invoice_uuid } });
        return { http: 502, message: String(err?.message || err) };
    }
};

const posaljiPartnerskiPonovno = async (partner_invoice_uuid) => {
    const { PartnerInvoiceModel } = getModels();
    const red = await PartnerInvoiceModel.findOne({ where: { partner_invoice_uuid } });
    if (!red) return { http: 404, message: "racun nije naden" };
    if (!red.fiskal_required) return { http: 400, message: "racun nije F2" };
    if (prosao(red)) return { http: 409, message: "racun je vec poslan u YesCor" };
    // fiskalizirajRacun sam upisuje gresku u f2_greske.
    const r = await fiskalizirajRacun(red, await fetchCompanyFromBackoffice());
    return r.ok
        ? { http: 200, message: "racun je poslan", yescor_document_id: r.document_id }
        : { http: 502, message: r.error || "YesCor je odbio racun" };
};

// POST /f2_resend { vrsta: 'racun' | 'partnerski', invoice_uuid }
const resendF2Controller = async (req, res) => {
    try {
        const { vrsta = "racun", invoice_uuid } = req.body || {};
        if (!invoice_uuid) {
            return res.status(400).send({ status: 400, data: { message: "nedostaje invoice_uuid" } });
        }
        const r = vrsta === "partnerski"
            ? await posaljiPartnerskiPonovno(invoice_uuid)
            : await posaljiRacunPonovno(invoice_uuid);
        res.status(r.http).send({ status: r.http, data: r });
    } catch (error) {
        console.log("resendF2Controller error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listF2ErrorsController, resendF2Controller };
