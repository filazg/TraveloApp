const { renderTemplateToPdfBuffer } = require("../../helpers/pdfRenderer");
const { prikupiDetalje } = require("./partnerCommissionController");

// Izvjestaj za proviziju u PDF-u — dokument koji partner dobiva u ruke i po
// kojem nam ispostavlja svoj racun. Detalji idu zasebno: izvjestaj je sazetak
// po prodajnom mjestu, a razrada zna imati desetke polazaka.
//
// Obuhvaca iskljucivo prodaju koju je partner odradio u nase ime; njegova
// vlastita prodaja ide obrnutim smjerom i nije predmet ovog izvjestaja.

const zbroji = (redci) => ({
    count: redci.reduce((z, r) => z + (r.count || 0), 0),
    tickets: redci.reduce((z, r) => z + (r.tickets || 0), 0),
    gross: +redci.reduce((z, r) => z + (Number(r.gross) || 0), 0).toFixed(2),
    base: +redci.reduce((z, r) => z + (Number(r.base) || 0), 0).toFixed(2),
    commission: +redci.reduce((z, r) => z + (Number(r.commission) || 0), 0).toFixed(2),
});

const grupiraj = (niz, kljuc) => {
    const out = new Map();
    for (const x of niz) {
        const k = kljuc(x);
        if (!out.has(k)) out.set(k, []);
        out.get(k).push(x);
    }
    return out;
};

// Polazak je tekst "DD.MM.YYYY. HH:mm"; new Date() ga ne parsira.
const uVrijeme = (s) => {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*(\d{1,2}):(\d{2})/.exec(String(s || ""));
    if (!m) return Number.MAX_SAFE_INTEGER;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
};

const iznosi = (arr) => ({
    gross: +arr.reduce((z, x) => z + (Number(x.gross) || 0), 0).toFixed(2),
    base: +arr.reduce((z, x) => z + (Number(x.base) || 0), 0).toFixed(2),
    commission: +arr.reduce((z, x) => z + (Number(x.commission) || 0), 0).toFixed(2),
});

// Samo prodaja u nase ime: partnerova vlastita prodaja ovdje ne ulazi.
const zaNasRacun = (podaci) => (podaci.rows || []).filter((r) => r.scope !== "channel");

const poMjestu = (redci) =>
    [...grupiraj(redci, (r) => `${r.business_premise_name}|${r.billing_device}|${r.operator}`).values()].map((arr) => ({
        business_premise_name: arr[0].business_premise_name,
        billing_device: arr[0].billing_device,
        operator: arr[0].operator,
        tickets: arr.length,
        count: arr.length,
        ...iznosi(arr),
    })).sort((a, b) => String(a.business_premise_name).localeCompare(String(b.business_premise_name), "hr"));

const dohvati = async (req) => {
    const { TicketsModel, InvoiceModel } = req.app.locals.models;
    const { partner_uuid, period, from, to } = req.query || {};
    return prikupiDetalje({ TicketsModel, InvoiceModel, partner_uuid, period, from, to });
};

const posalji = (res, buffer, naziv) => {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${naziv}"`);
    res.send(buffer);
};

const nazivDatoteke = (p, sufiks) =>
    `izvjestaj-provizija-${String(p.partner_name || "partner").replace(/[^\w-]+/g, "-")}-${p.from}-${p.to}${sufiks}.pdf`;

const renderCommissionReportPdfController = async (req, res) => {
    try {
        const podaci = await dohvati(req);
        const redci = poMjestu(zaNasRacun(podaci));
        const buffer = await renderTemplateToPdfBuffer("commissionReportTemplate.ejs", {
            p: podaci,
            redci,
            zbroj: zbroji(redci),
        });
        posalji(res, buffer, nazivDatoteke(podaci, ""));
    } catch (error) {
        console.log("renderCommissionReportPdfController error:", error?.message || error);
        res.status(error.status || 500).send(error.message || "PDF render failed");
    }
};

const renderCommissionReportDetailsPdfController = async (req, res) => {
    try {
        const podaci = await dohvati(req);
        const redci = zaNasRacun(podaci);

        const polasci = [...grupiraj(redci, (r) => r.route_uuid || `${r.departure_planed}|${r.line_name}`).values()]
            .map((arr) => ({
                departure: arr[0].departure_planed,
                line: arr[0].line_name || "",
                relation: [arr[0].departure_harbor_name, arr[0].arrival_harbor_name].filter(Boolean).join(" → "),
                count: arr.length,
                ...iznosi(arr),
            }))
            .sort((a, b) => uVrijeme(a.departure) - uVrijeme(b.departure));

        const operateri = [...grupiraj(redci, (r) => `${r.business_premise_name}|${r.billing_device}|${r.operator}`).values()]
            .map((arr) => {
                const vremena = arr.map((x) => (x.sold_at ? new Date(x.sold_at).getTime() : null)).filter((v) => v != null);
                return {
                    business_premise_name: arr[0].business_premise_name,
                    billing_device: arr[0].billing_device,
                    operator: arr[0].operator,
                    count: arr.length,
                    prva: vremena.length ? new Date(Math.min(...vremena)) : null,
                    zadnja: vremena.length ? new Date(Math.max(...vremena)) : null,
                    ...iznosi(arr),
                };
            })
            .sort((a, b) => b.gross - a.gross);

        const buffer = await renderTemplateToPdfBuffer("commissionReportDetailsTemplate.ejs", {
            p: podaci,
            polasci,
            operateri,
            zbrojPolazaka: zbroji(polasci),
            zbrojOperatera: zbroji(operateri),
        });
        posalji(res, buffer, nazivDatoteke(podaci, "-detalji"));
    } catch (error) {
        console.log("renderCommissionReportDetailsPdfController error:", error?.message || error);
        res.status(error.status || 500).send(error.message || "PDF render failed");
    }
};

module.exports = { renderCommissionReportPdfController, renderCommissionReportDetailsPdfController };
