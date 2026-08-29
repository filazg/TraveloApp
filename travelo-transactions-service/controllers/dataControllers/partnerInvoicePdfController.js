const { renderTemplateToPdfBuffer } = require("../../helpers/pdfRenderer");

// PDF partnerskog racuna i detalja uz njega.
//
// Racun se salje partneru i ide u knjigovodstvo, pa mora postojati kao
// dokument, a ne samo kao prikaz u portalu. Detalji idu zasebno: racun je
// dokument s tri stavke, a razrada zna imati desetke polazaka i vise korisnika.

const ucitaj = async ({ PartnerInvoiceModel, PartnerInvoiceItemModel, partner_invoice_uuid }) => {
    const racun = await PartnerInvoiceModel.findOne({ where: { partner_invoice_uuid } });
    if (!racun) return null;
    const stavke = await PartnerInvoiceItemModel.findAll({
        where: { partner_invoice_uuid },
        order: [["id", "ASC"]],
    });
    return {
        r: racun.toJSON ? racun.toJSON() : racun,
        stavke: stavke.map((s) => (s.toJSON ? s.toJSON() : s)),
    };
};

// Polazak je tekst "DD.MM.YYYY. HH:mm"; new Date() ga ne parsira, pa se za
// redoslijed slaze rucno. Nepoznat oblik ide na kraj.
const uVrijeme = (s) => {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*(\d{1,2}):(\d{2})/.exec(String(s || ""));
    if (!m) return Number.MAX_SAFE_INTEGER;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
};

const grupiraj = (niz, kljuc) => {
    const out = new Map();
    for (const x of niz) {
        const k = kljuc(x);
        if (!out.has(k)) out.set(k, []);
        out.get(k).push(x);
    }
    return out;
};

const zbroji = (redci, polja) =>
    polja.reduce((acc, p) => ({ ...acc, [p]: +redci.reduce((z, r) => z + (Number(r[p]) || 0), 0).toFixed(2) }), {});

const razrada = (stavke) => {
    // Po polascima — jedan polazak je jedan route_uuid.
    const polasci = [...grupiraj(stavke, (s) => s.route_uuid || "—").entries()].map(([, arr]) => {
        const prva = arr[0];
        return {
            departure: prva.departure,
            line: [prva.line_code, prva.line_name].filter(Boolean).join(" · "),
            relation: [prva.departure_harbor_name, prva.arrival_harbor_name].filter(Boolean).join(" → "),
            count: arr.length,
            gross: +arr.reduce((z, x) => z + (Number(x.gross_amount) || 0), 0).toFixed(2),
            commission: +arr.reduce((z, x) => z + (Number(x.commission_amount) || 0), 0).toFixed(2),
            net: +arr.reduce((z, x) => z + (Number(x.net_amount) || 0), 0).toFixed(2),
        };
    }).sort((a, b) => uVrijeme(a.departure) - uVrijeme(b.departure));

    // Po korisniku — tko je od partnerovih ljudi koliko prodao. Prodaja je jedan
    // potez, ne jedna karta.
    const korisnici = [...grupiraj(stavke, (s) => s.sold_by_username || "—").entries()].map(([korisnik, arr]) => {
        const vremena = arr.map((x) => (x.sale_datetime ? new Date(x.sale_datetime).getTime() : null)).filter((v) => v != null);
        return {
            korisnik,
            prodaja: new Set(arr.map((x) => x.order_uuid || `karta:${x.ticket_uuid}`)).size,
            karte: arr.length,
            prva: vremena.length ? new Date(Math.min(...vremena)) : null,
            zadnja: vremena.length ? new Date(Math.max(...vremena)) : null,
            gross: +arr.reduce((z, x) => z + (Number(x.gross_amount) || 0), 0).toFixed(2),
            commission: +arr.reduce((z, x) => z + (Number(x.commission_amount) || 0), 0).toFixed(2),
            net: +arr.reduce((z, x) => z + (Number(x.net_amount) || 0), 0).toFixed(2),
        };
    }).sort((a, b) => b.gross - a.gross);

    return {
        polasci,
        korisnici,
        zbrojPolazaka: { ...zbroji(polasci, ["gross", "commission", "net"]), count: polasci.reduce((z, p) => z + p.count, 0) },
        zbrojKorisnika: {
            ...zbroji(korisnici, ["gross", "commission", "net"]),
            prodaja: korisnici.reduce((z, k) => z + k.prodaja, 0),
            karte: korisnici.reduce((z, k) => z + k.karte, 0),
        },
    };
};

const posalji = (res, buffer, naziv) => {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${naziv}"`);
    res.send(buffer);
};

// Oznaka racuna ulazi u naziv datoteke; "/" u njoj nije dopusten.
const zaNaziv = (r) =>
    String(r.partner_invoice_code || `${r.partner_invoice_no}-${r.invoice_year}`).replace(/[^\w-]+/g, "-");

const renderPartnerInvoicePdfController = async (req, res) => {
    const models = req.app.locals.models;
    try {
        const partner_invoice_uuid = req.params.partner_invoice_uuid || req.query.partner_invoice_uuid;
        if (!partner_invoice_uuid) return res.status(400).send("partner_invoice_uuid required");

        const podaci = await ucitaj({ ...models, partner_invoice_uuid });
        if (!podaci) return res.status(404).send("Partner invoice not found");

        const buffer = await renderTemplateToPdfBuffer("partnerInvoiceTemplate.ejs", { r: podaci.r });
        posalji(res, buffer, `partner-racun-${zaNaziv(podaci.r)}.pdf`);
    } catch (error) {
        console.log("renderPartnerInvoicePdfController error:", error?.message || error);
        res.status(500).send("PDF render failed");
    }
};

const renderPartnerInvoiceDetailsPdfController = async (req, res) => {
    const models = req.app.locals.models;
    try {
        const partner_invoice_uuid = req.params.partner_invoice_uuid || req.query.partner_invoice_uuid;
        if (!partner_invoice_uuid) return res.status(400).send("partner_invoice_uuid required");

        const podaci = await ucitaj({ ...models, partner_invoice_uuid });
        if (!podaci) return res.status(404).send("Partner invoice not found");

        const buffer = await renderTemplateToPdfBuffer("partnerInvoiceDetailsTemplate.ejs", {
            r: podaci.r,
            ...razrada(podaci.stavke),
        });
        posalji(res, buffer, `partner-racun-${zaNaziv(podaci.r)}-detalji.pdf`);
    } catch (error) {
        console.log("renderPartnerInvoiceDetailsPdfController error:", error?.message || error);
        res.status(500).send("PDF render failed");
    }
};

module.exports = { renderPartnerInvoicePdfController, renderPartnerInvoiceDetailsPdfController };
