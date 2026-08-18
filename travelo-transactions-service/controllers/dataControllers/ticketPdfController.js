const QRCode = require("qrcode");
const { renderTemplateToPdfBuffer } = require("../../helpers/pdfRenderer");

// QR payload mirrors the legacy template format.
const qrPayload = (t) =>
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
        .join(";");

// Map TicketsModel row → fields the legacy EJS template expects.
// Template uses `ticket_arrival_harbor_name`, `ticket_departure_planed`,
// `sales_route_uuid` (prefixed aliases) and our pre-generated `qr_data_url`.
const toTemplateTicket = async (t) => ({
    ticket_uuid: t.ticket_uuid,
    ticket_code: t.ticket_code,
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
});

const loadTickets = async ({ TicketsModel, order_uuid, order_uuids }) => {
    const where = { is_active: true };
    if (Array.isArray(order_uuids) && order_uuids.length) where.order_uuid = order_uuids;
    else if (order_uuid) where.order_uuid = order_uuid;
    const tickets = await TicketsModel.findAll({ where, order: [["id", "ASC"]] });
    return Promise.all(tickets.map(toTemplateTicket));
};

const renderTicketsPdf = async (ticketsData) => {
    if (!ticketsData.length) return null;
    // Match legacy behaviour: no explicit margins, let Puppeteer use its default
    // (zero). Template + browser default body margin handle spacing.
    return renderTemplateToPdfBuffer(
        "ticketsTamplate.ejs",
        { ticketsData, logo: "logo.png" },
        { margin: { top: "0", right: "0", bottom: "0", left: "0" } }
    );
};

const buildTicketsPdfBuffer = async ({ TicketsModel, order_uuid, order_uuids }) => {
    const ticketsData = await loadTickets({ TicketsModel, order_uuid, order_uuids });
    return renderTicketsPdf(ticketsData);
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

        const buffer = await renderTicketsPdf(ticketsData);
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

module.exports = { renderTicketsPdfController, buildTicketsPdfBuffer };
