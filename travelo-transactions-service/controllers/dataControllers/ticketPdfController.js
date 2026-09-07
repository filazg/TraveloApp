const QRCode = require("qrcode");
const axios = require("axios");
const { renderTemplateToPdfBuffer } = require("../../helpers/pdfRenderer");
const { brojZaIspis, qrSaSuffixom } = require("../../helpers/ticketCopyMark");
const { PREDLOSCI, KANALI, predlozak, ZADANI } = require("../../helpers/ticketTemplates");
const { getCoreServiceConfigData } = require("../configSyncController");
const { zapisiKopiju } = require("./ticketCopyPrintController");

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

// Podaci prijevoznika za zaglavlje i podnozje karte. Prije je u predlosku
// stajalo upisano ime, pa bi svaka druga instalacija ispisivala tude.
const podaciTvrtke = async () => {
    try {
        const core = await getCoreServiceConfigData();
        const url = core?.services?.backoffice?.url;
        if (!url) return {};
        const r = await axios.get(`${url}/company`, { timeout: 8000, validateStatus: () => true });
        const c = r.data?.data?.company;
        return (Array.isArray(c) ? c[0] : c) || {};
    } catch (error) {
        console.log("podaci tvrtke nisu dohvaceni:", error?.message || error);
        return {};
    }
};

const loadTickets = async ({ TicketsModel, order_uuid, order_uuids, kopija = null }) => {
    const where = { is_active: true };
    if (Array.isArray(order_uuids) && order_uuids.length) where.order_uuid = order_uuids;
    else if (order_uuid) where.order_uuid = order_uuid;
    const tickets = await TicketsModel.findAll({ where, order: [["id", "ASC"]] });

    // Ponovni ispis iz portala je kopija kao i svaka druga: evidentira se i
    // dobiva svoja tri znaka. Bez toga bi s pisaca izasla karta koja izgleda
    // kao original, a upravo je razlikovanje razlog zbog kojeg oznaka postoji.
    if (!kopija) return Promise.all(tickets.map(toTemplateTicket));

    const oznacene = [];
    for (const t of tickets) {
        let suffix = t.ticket_code_suffix;
        try {
            const zapis = await zapisiKopiju({
                ticket_uuid: t.ticket_uuid,
                ticket_code: t.ticket_code,
                operator_name: kopija.operator_name || null,
                billing_device_uuid: kopija.billing_device_uuid || null,
                billing_device_name: kopija.billing_device_name || null,
                business_premise_name: kopija.business_premise_name || null,
                origin: kopija.origin || "portal",
            });
            if (zapis?.suffix) suffix = zapis.suffix;
        } catch (error) {
            // Neuspjela evidencija ne smije zaustaviti ispis — putnik ceka kartu.
            console.log("kopija nije evidentirana:", error?.message || error);
        }
        // Sirovi red u bazi ostaje netaknut; oznaka kopije zivi uz sam ispis, a
        // QR se ionako slaze iz polja karte pa nova oznaka ulazi i u njega.
        const zaIspis = t.toJSON ? t.toJSON() : { ...t };
        zaIspis.ticket_code_suffix = suffix;
        oznacene.push(zaIspis);
    }
    return Promise.all(oznacene.map(toTemplateTicket));
};

const renderTicketsPdf = async (ticketsData, { channel = null, company = null } = {}) => {
    if (!ticketsData.length) return null;

    const tvrtka = company || {};

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
        { ticketsData, logo: "logo.png", summary, companyName: tvrtka.name || "", company: tvrtka },
        { margin: { top: "0", right: "0", bottom: "0", left: "0" } }
    );
};

const buildTicketsPdfBuffer = async ({ TicketsModel, order_uuid, order_uuids, channel, company }) => {
    const ticketsData = await loadTickets({ TicketsModel, order_uuid, order_uuids });
    // Podaci prijevoznika se dohvacaju ovdje ako ih pozivatelj nije dao — inace
    // bi novi predlozak isao u mail s praznim zaglavljem.
    return renderTicketsPdf(ticketsData, {
        channel,
        company: company || (await podaciTvrtke()),
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

        // Ponovni ispis se najavljuje s copy=1; tko ga radi i s kojeg uredaja
        // salje pozivatelj — servis to sam ne moze znati.
        const kopija = ["1", "true", "yes"].includes(String(req.query.copy || "").toLowerCase())
            ? {
                operator_name: req.query.operator || null,
                billing_device_uuid: req.query.billing_device_uuid || null,
                billing_device_name: req.query.billing_device_name || null,
                business_premise_name: req.query.business_premise_name || null,
                origin: req.query.origin || "portal",
            }
            : null;

        const ticketsData = await loadTickets({ TicketsModel, order_uuid, order_uuids, kopija });
        if (!ticketsData.length) return res.status(404).send("No tickets for this order");

        // Kanal salje pozivatelj — on jedini zna tko je. Izvodenje iz podataka
        // bi trazilo pogadanje: `origin` je na vecini karata prazan.
        const buffer = await renderTicketsPdf(ticketsData, {
            channel: req.query.channel || null,
            company: await podaciTvrtke(),
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

// Ogledne karte za pregled predloska. Izmisljene su namjerno: pregled se gleda
// prije nego je predlozak igdje ukljucen, pa ne smije ovisiti o tome postoji li
// u bazi prikladna narudzba, a ni pokazati tudeg putnika.
const OGLEDNE = [
    {
        ticket_uuid: "3f2a1c94-5b7e-4d21-9a08-6c1de4b7f012",
        ticket_code: "ogled-primjer1",
        ticket_code_suffix: "a4c",
        ticket_type_name: "Odrasli",
        line_code: "9604",
        line_name: "9604 Split – Hvar – Korčula",
        departure: "12.07.2026. 08:00",
        arrival: "12.07.2026. 09:05",
        departure_planed: "12.07.2026. 08:00",
        arrival_planed: "12.07.2026. 09:05",
        departure_harbor_name: "Split",
        arrival_harbor_name: "Hvar",
        route_uuid: "ogledna-ruta",
        ticket_type_uuid: "ogledni-tip",
    },
    {
        ticket_uuid: "8b41e77d-2c60-49aa-b3f5-71920ac4e355",
        ticket_code: "ogled-primjer2",
        ticket_code_suffix: "b7k",
        ticket_type_name: "Djeca 3–12",
        line_code: "9604",
        line_name: "9604 Split – Hvar – Korčula",
        departure: "12.07.2026. 08:00",
        arrival: "12.07.2026. 09:05",
        departure_planed: "12.07.2026. 08:00",
        arrival_planed: "12.07.2026. 09:05",
        departure_harbor_name: "Split",
        arrival_harbor_name: "Hvar",
        route_uuid: "ogledna-ruta",
        ticket_type_uuid: "ogledni-tip",
    },
    {
        ticket_uuid: "c05d9e13-7f48-4b90-8a12-4de6013b9a77",
        ticket_code: "ogled-primjer3",
        ticket_code_suffix: "m2p",
        ticket_type_name: "Otočna karta",
        line_code: "9604",
        line_name: "9604 Split – Hvar – Korčula",
        departure: "12.07.2026. 08:00",
        arrival: "12.07.2026. 09:05",
        departure_planed: "12.07.2026. 08:00",
        arrival_planed: "12.07.2026. 09:05",
        departure_harbor_name: "Split",
        arrival_harbor_name: "Hvar",
        route_uuid: "ogledna-ruta",
        ticket_type_uuid: "ogledni-tip",
        is_island: true,
        seop_card_no: "HR-0000-0000",
        seop_pravo: "Stalni stanovnik otoka",
        seop_otok: "Hvar",
    },
];

// Pregled predloska na oglednim kartama. Sazetak se prikazuje kad ga predlozak
// podnosi, bez obzira na prag — prag je stvar primjene, a ovdje se gleda izgled.
const ticketTemplatePreviewController = async (req, res) => {
    try {
        const izabran = predlozak(req.query.template);
        const ticketsData = await Promise.all(OGLEDNE.map(toTemplateTicket));
        const summary = izabran.supports_summary ? podaciSazetka(ticketsData) : null;

        const buffer = await renderTemplateToPdfBuffer(
            izabran.file,
            { ticketsData, logo: "logo.png", summary, ...(await (async () => {
                const t = await podaciTvrtke();
                return { companyName: t.name || "", company: t };
            })()) },
            { margin: { top: "0", right: "0", bottom: "0", left: "0" } }
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="ogled-${izabran.key}.pdf"`);
        return res.end(buffer);
    } catch (error) {
        console.log("ticketTemplatePreviewController error:", error);
        return res.status(500).send("Pregled predloska nije uspio");
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

module.exports = {
    renderTicketsPdfController,
    buildTicketsPdfBuffer,
    ticketTemplateCatalogController,
    ticketTemplatePreviewController,
};
