const QRCode = require("qrcode");
const axios = require("axios");
const { renderTemplateToPdfBuffer } = require("../../helpers/pdfRenderer");
const { brojZaIspis, qrSaSuffixom } = require("../../helpers/ticketCopyMark");
const { PREDLOSCI, KANALI, predlozak, ZADANI } = require("../../helpers/ticketTemplates");
const { getCoreServiceConfigData } = require("../configSyncController");

// Postavka predloska po kanalu. Zivi u boat servisu, uz ostalo sto se tice
// same voznje; ovdje se samo cita.
//
// Nedostupna postavka ne smije zaustaviti ispis karte — putnik je ceka. Tada se
// uzima zatecen predlozak, isti onaj koji je vrijedio i prije nego su predlosci
// uopce postojali.
const postavkaPredloska = async (channel) => {
    const zadano = { template_key: ZADANI, summary_threshold: 0 };
    if (!channel) return zadano;
    try {
        const core = await getCoreServiceConfigData();
        const url = core?.services?.boat?.url;
        if (!url) return zadano;
        const r = await axios.get(`${url}/ticket_templates/${channel}`, {
            timeout: 8000,
            validateStatus: () => true,
        });
        const t = r.data?.data?.template;
        return t ? { template_key: t.template_key, summary_threshold: Number(t.summary_threshold) || 0 } : zadano;
    } catch (error) {
        console.log("postavka predloska nije dohvacena:", error?.message || error);
        return zadano;
    }
};

// Sto ide u zaglavlje sazetka. Sve karte jedne narudzbe su u pravilu isti
// polazak; kad nisu, relacija se izostavlja umjesto da se prikaze prva i
// prisvoji tudi podatak.
const podaciSazetka = (ticketsData) => {
    const relacije = new Set(ticketsData.map((t) => `${t.departure_harbor_name || ""} → ${t.arrival_harbor_name || ""}`));
    const polasci = new Set(ticketsData.map((t) => t.departure_fmt || ""));
    return {
        route: relacije.size === 1 ? [...relacije][0] : null,
        departure: polasci.size === 1 ? [...polasci][0] : null,
    };
};

// QR payload mirrors the legacy template format. Sufiks koji razlikuje original
// od kopije ide kao osmo polje — ako ga karta ima; starije karte ostaju sedmeročlane.
const qrPayload = (t) =>
    qrSaSuffixom(
        [
            t.ticket_uuid,
            t.line_code,
            t.departure_harbor_name,
            t.arrival_harbor_name,
            t.departure_planed,
            t.route_uuid,
            t.ticket_type_uuid,
        ]
            .map((v) => (v == null ? "" : String(v)))
            .join(";"),
        t.ticket_code_suffix,
    );

// Map TicketsModel row → fields the legacy EJS template expects.
// Template uses `ticket_arrival_harbor_name`, `ticket_departure_planed`,
// `sales_route_uuid` (prefixed aliases) and our pre-generated `qr_data_url`.
const toTemplateTicket = async (t) => ({
    ticket_uuid: t.ticket_uuid,
    // Na ispisu broj karte nosi i tri znaka oznake; u bazi ostaju odvojeni.
    ticket_code: brojZaIspis(t.ticket_code, t.ticket_code_suffix),
    ticket_type_uuid: t.ticket_type_uuid,
    ticket_type_name: t.ticket_type_name,
    departure: t.departure,
    departure_harbor_name: t.departure_harbor_name,
    departure_harbor_id: t.departure_harbor_id,
    // Fallback je isao na departure_planed, pa je karta bez upisanog dolaska
    // pokazivala vrijeme POLASKA kao vrijeme dolaska. Radije prazno nego krivo.
    arrival: t.arrival || t.arrival_planed || '',
    arrival_harbor_name: t.arrival_harbor_name,
    arrival_harbor_id: t.arrival_harbor_id,
    line_code: t.line_code,
    line_name: t.line_name,
    ticket_departure_harbor_name: t.departure_harbor_name,
    ticket_arrival_harbor_name: t.arrival_harbor_name,
    ticket_departure_planed: t.departure_planed,
    sales_route_uuid: t.route_uuid,
    // SEOP / otočne kartice — podaci za vizualnu provjeru pri ukrcaju.
    is_island: t.is_island === true,
    seop_card_no: t.seop_card_no || null,
    seop_pravo: t.seop_pravo || null,
    seop_otok: t.seop_otok || null,
    seop_discount_pct: t.seop_discount_pct ?? null,
    qr_data_url: await QRCode.toDataURL(qrPayload(t), { width: 240, margin: 1 }),
    // Ujednacen zapis za novi predlozak; stari i dalje cita sirova polja.
    departure_fmt: fmtDatum(t.departure || t.departure_planed),
    arrival_fmt: fmtDatum(t.arrival || t.arrival_planed),
    ticket_code_suffix: t.ticket_code_suffix || null,
});

// Polazak i dolazak se u bazi zapisuju u dva oblika: web prodaja pise
// "DD/MM/YYYY HH:mm", a plovidbeni red "DD.MM.YYYY. HH:mm". Na istoj karti su to
// dosad bila dva razlicita zapisa jedan ispod drugoga.
//
// Novi predlozak ih izjednacava; stari se NE dira, na njemu su vise izdane karte
// i mijenjati mu izgled usput nema razloga.
const fmtDatum = (v) => {
    const t = String(v || "").trim();
    if (!t) return "";
    const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?(?:\s+(\d{1,2}):(\d{2}))?/.exec(t);
    if (!m) return t;
    const [, d, mo, y, hh, mm] = m;
    const dan = `${String(d).padStart(2, "0")}.${String(mo).padStart(2, "0")}.${y}.`;
    return hh ? `${dan} ${String(hh).padStart(2, "0")}:${mm}` : dan;
};

// Naziv tvrtke za zaglavlje karte. Prije je bio upisan u sam predlozak, pa bi
// svaka druga instalacija ispisivala tudje ime.
const nazivTvrtke = async () => {
    try {
        const core = await getCoreServiceConfigData();
        const url = core?.services?.backoffice?.url;
        if (!url) return "";
        const r = await axios.get(`${url}/company`, { timeout: 8000, validateStatus: () => true });
        const c = r.data?.data?.company;
        return (Array.isArray(c) ? c[0]?.name : c?.name) || "";
    } catch (error) {
        console.log("naziv tvrtke nije dohvacen:", error?.message || error);
        return "";
    }
};

const loadTickets = async ({ TicketsModel, order_uuid, order_uuids }) => {
    const where = { is_active: true };
    if (Array.isArray(order_uuids) && order_uuids.length) where.order_uuid = order_uuids;
    else if (order_uuid) where.order_uuid = order_uuid;
    const tickets = await TicketsModel.findAll({ where, order: [["id", "ASC"]] });
    return Promise.all(tickets.map(toTemplateTicket));
};

const renderTicketsPdf = async (ticketsData, { channel = null, companyName = "" } = {}) => {
    if (!ticketsData.length) return null;

    const postavka = await postavkaPredloska(channel);
    const izabran = predlozak(postavka.template_key);

    // Sazetak ide kao PRVA STRANICA istog dokumenta, ne kao zaseban PDF: karte
    // se svugdje otvaraju s jedne adrese — u kartici preglednika i kao privitak
    // — pa bi drugi dokument trazio izmjenu na svakom od tih mjesta.
    const prag = izabran.supports_summary ? postavka.summary_threshold : 0;
    const summary = prag > 0 && ticketsData.length >= prag ? podaciSazetka(ticketsData) : null;

    // Match legacy behaviour: no explicit margins, let Puppeteer use its default
    // (zero). Template + browser default body margin handle spacing.
    return renderTemplateToPdfBuffer(
        izabran.file,
        { ticketsData, logo: "logo.png", summary, companyName },
        { margin: { top: "0", right: "0", bottom: "0", left: "0" } }
    );
};

const buildTicketsPdfBuffer = async ({ TicketsModel, order_uuid, order_uuids, channel, companyName }) => {
    const ticketsData = await loadTickets({ TicketsModel, order_uuid, order_uuids });
    // Naziv tvrtke se dohvaca ovdje ako ga pozivatelj nije dao — inace bi novi
    // predlozak isao u mail s praznim zaglavljem, a stari ga i tako ne cita.
    return renderTicketsPdf(ticketsData, {
        channel,
        companyName: companyName || (await nazivTvrtke()),
    });
};

const renderTicketsPdfController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const order_uuid = req.params.order_uuid || req.query.order_uuid;
        const order_uuids_raw = req.query.order_uuids;
        const order_uuids = typeof order_uuids_raw === "string"
            ? order_uuids_raw.split(",").map((s) => s.trim()).filter(Boolean)
            : Array.isArray(order_uuids_raw) ? order_uuids_raw : null;

        if (!order_uuid && (!order_uuids || !order_uuids.length)) {
            return res.status(400).send("order_uuid or order_uuids required");
        }

        const ticketsData = await loadTickets({ TicketsModel, order_uuid, order_uuids });
        if (!ticketsData.length) return res.status(404).send("No tickets for this order");

        // Kanal salje pozivatelj — on jedini zna tko je. Izvodenje iz podataka
        // bi trazilo pogadanje: `origin` je na vecini karata prazan.
        const buffer = await renderTicketsPdf(ticketsData, {
            channel: req.query.channel || null,
            companyName: await nazivTvrtke(),
        });
        const fnameHint = order_uuid
            ? order_uuid.slice(0, 8)
            : `bulk-${order_uuids[0].slice(0, 8)}`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="tickets-${fnameHint}.pdf"`
        );
        return res.end(buffer);
    } catch (error) {
        console.log("renderTicketsPdfController error:", error);
        return res.status(500).send("PDF generation failed");
    }
};

// Katalog dostupnih predlozaka i kanala. Zivi ovdje jer ovdje i postoje —
// postavka u boat servisu pamti samo koji je izabran.
const ticketTemplateCatalogController = async (_req, res) => {
    res.send({
        status: 200,
        data: {
            templates: PREDLOSCI.map(({ key, label, description, supports_summary }) =>
                ({ key, label, description, supports_summary })),
            channels: KANALI,
        },
    });
};

module.exports = { renderTicketsPdfController, buildTicketsPdfBuffer, ticketTemplateCatalogController };
