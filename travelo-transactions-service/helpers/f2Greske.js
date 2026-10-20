const crypto = require("crypto");
const { getModels } = require("../dbModels");
const { poljaUredaja } = require("./naplatniUredaj");

// Citljiva poruka iz YesCor odgovora. Odbijeni dokument nosi opcu poruku
// ("Vas zahtjev nije valjan!"), a pravi razlog je u `details` i
// `validationErrors` — bez njih se u Kontroli ne vidi sto treba popraviti.
const porukaIzOdgovora = (data) => {
    if (!data || typeof data !== "object") return data ? String(data) : null;
    const e = data.error || data;
    const dijelovi = [];
    if (e.message) dijelovi.push(String(e.message).trim());
    if (e.details) dijelovi.push(String(e.details).trim());
    for (const v of e.validationErrors || []) {
        if (v?.message) dijelovi.push(String(v.message).trim());
    }
    if (data.errorMessage) dijelovi.push(String(data.errorMessage).trim());
    if (data.fiscalizationErrorMessage) dijelovi.push(String(data.fiscalizationErrorMessage).trim());
    return dijelovi.length ? [...new Set(dijelovi)].join("\n") : JSON.stringify(data).slice(0, 2000);
};

// Podaci racuna uz zapis — iz baze, da pozivatelj ne mora skupljati polja koja
// svaki tok drzi pod drugim imenom.
const podaciRacuna = async (vrsta, invoice_uuid, red) => {
    const { InvoiceModel, PartnerInvoiceModel } = getModels();
    if (vrsta === "partnerski") {
        const r = red || (invoice_uuid
            ? await PartnerInvoiceModel.findOne({ where: { partner_invoice_uuid: invoice_uuid }, raw: true })
            : null);
        if (!r) return { invoice_uuid };
        return {
            invoice_uuid: r.partner_invoice_uuid,
            invoice_code: r.partner_invoice_code || null,
            invoice_no: r.partner_invoice_no != null ? String(r.partner_invoice_no) : null,
            invoice_date: r.invoice_date || null,
            iznos: r.gross_amount ?? null,
            kupac_naziv: r.partner_name || null,
            kupac_oib: r.partner_legal_id || r.partner_vat_id || null,
            ...(await poljaUredaja(r.billing_device_uuid, "terminal")),
        };
    }
    const r = invoice_uuid ? await InvoiceModel.findOne({ where: { invoice_uuid }, raw: true }) : null;
    if (!r) return { invoice_uuid };
    return {
        invoice_uuid,
        invoice_code: r.invoice_code || null,
        invoice_no: r.invoice_no != null ? String(r.invoice_no) : null,
        invoice_date: r.invoice_date || null,
        iznos: r.invoice_amount ?? null,
        kupac_naziv: r.buyer_company_name || r.buyer_name || null,
        kupac_oib: r.buyer_oib || null,
        operator: r.invoice_operator_name || r.operater_name || null,
        ...(await poljaUredaja(r.invoice_billing_device_uuid, "terminal")),
    };
};

// Upis jednog neuspjelog F2 pokusaja. Best-effort: zapis u Kontrolu ne smije
// srusiti prodaju ni generiranje racuna.
//
//   greska   — Error iz bacenog poziva (token, mreza…)
//   odgovor  — tijelo YesCor odgovora kad je vratio gresku
async function zabiljeziF2Gresku({
    vrsta = "racun", izvor = null, faza = "slanje", invoice_uuid = null, red = null,
    http_status = null, greska = null, odgovor = null, yescor_document_id = null,
}) {
    try {
        const { F2ErrorModel } = getModels();
        const poruka = greska
            ? String(greska?.message || greska)
            : porukaIzOdgovora(odgovor);
        await F2ErrorModel.create({
            uuid: crypto.randomUUID(),
            vrsta,
            izvor,
            faza,
            ...(await podaciRacuna(vrsta, invoice_uuid, red)),
            yescor_document_id,
            http_status,
            poruka,
            odgovor: odgovor && typeof odgovor === "object" ? odgovor : null,
        });
    } catch (e) {
        console.log("[f2-greska] zapis nije uspio:", e?.message || e);
    }
}

module.exports = { zabiljeziF2Gresku, porukaIzOdgovora };
