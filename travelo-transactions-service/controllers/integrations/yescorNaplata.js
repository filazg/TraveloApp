// Prijava naplate F2 racuna Poreznoj preko YesCora (document-payment).
//
// Racun se prijavljuje tek kad je fiskaliziran — naplata se veze uz YesCor
// documentId, a prije fiskalizacije ga Porezna jos ne zna. Placen pri
// izdavanju ide sam od sebe; virman tek kad se naplata potvrdi u portalu
// (invoice_paid postane true). Oboje pokupi isti scheduler.
const { Op } = require("sequelize");
const { sendDocumentPayment, getDocumentPaymentStatus } = require("./yescorClient");
const { f2OznakaRacuna } = require("./sendInvoiceToYescor");
const { f2OznakaPartnerskog, iznosPartnerskog } = require("./sendPartnerInvoiceToYescor");
const { VRSTE_NAPLATE, danUZagrebu } = require("../../helpers/naplata");
const { zabiljeziF2Gresku } = require("../../helpers/f2Greske");

const STATUS_MAP = { 1: "new", 2: "sending", 3: "sent", 4: "error" };
const U_TIJEKU = ["submitted", "new", "sending"];

// Neuspjela prijava se ponavlja, ali ne na svakom krugu od 30 s.
const PONOVI_NAKON_MS = 10 * 60 * 1000;

const porukaGreske = (data) => {
    const e = data?.error || data || {};
    const dijelovi = [e.message, e.details, ...(data?.validationErrors || e.validationErrors || []).map((v) => v?.message)]
        .filter(Boolean).map((x) => String(x).trim());
    return dijelovi.length ? [...new Set(dijelovi)].join("\n") : JSON.stringify(data || {}).slice(0, 2000);
};

// Sto se o racunu prijavljuje — obicni i zbirni partnerski racun drze iste
// podatke pod razlicitim imenima.
const podaciNaplate = (inv, vrsta) => {
    if (vrsta === "partnerski") {
        const { broj, datum } = f2OznakaPartnerskog(inv);
        return {
            broj, datum,
            naziv: inv.partner_name || null,
            oib: inv.partner_legal_id || inv.partner_vat_id || null,
            iznos: iznosPartnerskog(inv),
        };
    }
    const { broj, datum } = f2OznakaRacuna(inv);
    return {
        broj, datum,
        naziv: inv.buyer_company_name || inv.buyer_name || null,
        oib: inv.buyer_oib || null,
        iznos: Math.round(Number(inv.invoice_amount || 0) * 100) / 100,
    };
};

// Zapis u Kontrolu F2 — partnerski racun se predaje cijelim redom.
const zapisGreske = (inv, vrsta) => (vrsta === "partnerski"
    ? { vrsta, red: inv.get({ plain: true }) }
    : { vrsta, invoice_uuid: inv.invoice_uuid });

const prijaviNaplatu = async (inv, vrsta = "racun") => {
    const { broj, datum, naziv, oib, iznos } = podaciNaplate(inv, vrsta);
    const payload = {
        documentId: inv.yescor_document_id,
        documentNumber: broj,
        documentDate: datum,
        documentPartyName: naziv,
        documentPartyTaxNumber: oib,
        paymentDate: inv.invoice_paid_date || danUZagrebu(inv.invoice_date),
        amount: iznos,
        paymentType: inv.invoice_paid_type || VRSTE_NAPLATE.OSTALO,
    };
    const prije = inv.yescor_payment_status;
    try {
        const r = await sendDocumentPayment(payload);
        const id = typeof r.data?.data === "string" ? r.data.data : r.data?.data?.id;
        const ok = r.status >= 200 && r.status < 300 && !!id;
        if (!ok && prije !== "failed") {
            await zabiljeziF2Gresku({
                izvor: "naplata", faza: "naplata", ...zapisGreske(inv, vrsta),
                yescor_document_id: inv.yescor_document_id, http_status: r.status, odgovor: r.data,
            });
        }
        await inv.update({
            yescor_payment_id: ok ? id : inv.yescor_payment_id,
            yescor_payment_status: ok ? "submitted" : "failed",
            yescor_payment_error: ok ? null : porukaGreske(r.data),
            yescor_payment_last_sync_at: new Date(),
        });
        console.log(`[yescor-naplata] racun ${broj} → ${ok ? "submitted" : "failed"} (HTTP ${r.status})`);
        return ok;
    } catch (e) {
        console.log(`[yescor-naplata] racun ${broj} prijava nije uspjela:`, e?.message || e);
        if (prije !== "failed") {
            await zabiljeziF2Gresku({
                izvor: "naplata", faza: "naplata", ...zapisGreske(inv, vrsta),
                yescor_document_id: inv.yescor_document_id, greska: e,
            });
        }
        await inv.update({
            yescor_payment_status: "failed",
            yescor_payment_error: String(e?.message || e).slice(0, 2000),
            yescor_payment_last_sync_at: new Date(),
        });
        return false;
    }
};

// Racuni kojima naplata ceka prijavu: fiskalizirani, placeni, jos
// neprijavljeni ili neuspjeli prije PONOVI_NAKON_MS. Storno racun (negativan
// iznos) nema naplate.
const cekaPrijavu = () => ({
    yescor_document_id: { [Op.ne]: null },
    yescor_fiscalization_status: "successful",
    invoice_paid: true,
    [Op.or]: [
        { yescor_payment_status: null },
        {
            yescor_payment_status: "failed",
            yescor_payment_last_sync_at: { [Op.lt]: new Date(Date.now() - PONOVI_NAKON_MS) },
        },
    ],
});

const prijaviNaplate = async (models) => {
    const { InvoiceModel, PartnerInvoiceModel } = models;
    const skupovi = [
        [InvoiceModel, "racun", { invoice_amount: { [Op.gt]: 0 } }],
        [PartnerInvoiceModel, "partnerski", {}],
    ];
    let prijavljeno = 0, kandidata = 0;
    for (const [model, vrsta, dodatno] of skupovi) {
        if (!model) continue;
        const kandidati = await model.findAll({
            where: { ...cekaPrijavu(), ...dodatno },
            limit: 20,
            order: [["invoice_date", "ASC"]],
        });
        kandidata += kandidati.length;
        for (const inv of kandidati) {
            if (await prijaviNaplatu(inv, vrsta)) prijavljeno += 1;
        }
    }
    return { prijavljeno, kandidata };
};

// Stanje vec poslanih prijava, dok YesCor ne javi sent ili error.
const osvjeziNaplate = async (models) => {
    const { InvoiceModel, PartnerInvoiceModel } = models;
    let provjereno = 0;
    for (const [model, vrsta] of [[InvoiceModel, "racun"], [PartnerInvoiceModel, "partnerski"]]) {
        if (!model) continue;
        const uTijeku = await model.findAll({
            where: {
                yescor_payment_id: { [Op.ne]: null },
                yescor_payment_status: { [Op.in]: U_TIJEKU },
            },
            limit: 50,
            order: [["yescor_payment_last_sync_at", "ASC"]],
        });
        provjereno += uTijeku.length;
        for (const inv of uTijeku) {
            try {
                const r = await getDocumentPaymentStatus(inv.yescor_payment_id);
                if (r.status !== 200) {
                    await inv.update({ yescor_payment_last_sync_at: new Date() });
                    continue;
                }
                const dto = r.data?.data || {};
                const status = STATUS_MAP[dto.status] || String(dto.status || "");
                if (status === "error" && inv.yescor_payment_status !== "error") {
                    await zabiljeziF2Gresku({
                        izvor: "status", faza: "naplata", ...zapisGreske(inv, vrsta),
                        yescor_document_id: inv.yescor_document_id, http_status: r.status, odgovor: dto,
                    });
                }
                await inv.update({
                    yescor_payment_status: status,
                    yescor_payment_error: dto.errorMessage || null,
                    yescor_payment_last_sync_at: new Date(),
                });
            } catch (e) {
                console.log(`[yescor-naplata] status ${vrsta} ${inv.yescor_payment_id}:`, e?.message || e);
                try { await inv.update({ yescor_payment_last_sync_at: new Date() }); } catch (_) {}
            }
        }
    }
    return { provjereno };
};

module.exports = { prijaviNaplatu, prijaviNaplate, osvjeziNaplate };
