const { getModels } = require("../../dbModels");
const { VRSTE_NAPLATE, danUZagrebu } = require("../../helpers/naplata");
const { prijaviNaplatu } = require("../integrations/yescorNaplata");

const greska = (res, http, message) => res.status(http).send({ status: http, data: { message } });

// POST /invoice_payment_confirm { invoice_uuid, paid_date, paid_type, confirmed_by }
//
// Naknadna potvrda naplate racuna koji nije placen pri izdavanju (virman).
// Potvrda je jednokratna: za F2 racun naplata odlazi Poreznoj i ne moze se
// povuci, pa se ni ovdje ne nudi ponistavanje.
const confirmInvoicePaymentController = async (req, res) => {
    try {
        const { InvoiceModel } = getModels();
        const { invoice_uuid, paid_date, paid_type, confirmed_by } = req.body?.body || req.body || {};
        if (!invoice_uuid) return greska(res, 400, "nedostaje invoice_uuid");

        const inv = await InvoiceModel.findOne({ where: { invoice_uuid } });
        if (!inv) return greska(res, 404, "racun ne postoji");
        if (Number(inv.invoice_amount) < 0) return greska(res, 409, "storno racun nema naplatu");
        if (inv.invoice_canceled) return greska(res, 409, "racun je storniran");
        if (inv.invoice_paid !== false) return greska(res, 409, "racun je vec placen");

        const danas = danUZagrebu();
        const datum = paid_date ? String(paid_date).slice(0, 10) : danas;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || isNaN(new Date(datum))) {
            return greska(res, 400, "neispravan datum naplate");
        }
        if (datum > danas) return greska(res, 400, "datum naplate ne moze biti u buducnosti");
        if (datum < danUZagrebu(inv.invoice_date)) {
            return greska(res, 400, "datum naplate ne moze biti prije datuma racuna");
        }
        const vrsta = paid_type == null || paid_type === "" ? VRSTE_NAPLATE.TRANSAKCIJSKI : Number(paid_type);
        if (!Object.values(VRSTE_NAPLATE).includes(vrsta)) return greska(res, 400, "neispravna vrsta naplate");

        await inv.update({
            invoice_paid: true,
            invoice_paid_date: datum,
            invoice_paid_type: vrsta,
            invoice_paid_confirmed_by: confirmed_by || null,
            invoice_paid_confirmed_at: new Date(),
            yescor_payment_status: null,
            yescor_payment_error: null,
        });

        // Fiskaliziran F2 racun prijavljuje se odmah, da portal vidi ishod.
        // Ostale (jos u fiskalizaciji) pokupi scheduler cim prodju.
        if (inv.yescor_document_id && inv.yescor_fiscalization_status === "successful") {
            await prijaviNaplatu(inv);
        }

        console.log(`[naplata] racun ${inv.invoice_code || inv.invoice_no} potvrden ${datum} (vrsta ${vrsta}) — ${confirmed_by || "?"}`);
        res.send({ status: 200, data: { invoice: inv.get({ plain: true }) } });
    } catch (error) {
        console.log("confirmInvoicePaymentController error:", error?.message || error);
        greska(res, 500, error.message);
    }
};

module.exports = { confirmInvoicePaymentController };
