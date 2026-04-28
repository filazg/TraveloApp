const { Resend } = require("resend");
const { buildInvoicePdfBuffer } = require("./invoicePdfController");
const { buildTicketsPdfBuffer } = require("./ticketPdfController");

const API_KEY = process.env.RESEND_API_KEY || "re_eMiQgU7N_71D28aQsG3w1nSpD71CzuwCp";
const FROM = process.env.RESEND_FROM || "Kapetan Luka <noreply@tech4beez.com>";

const textToHtml = (text) => {
    if (!text) return "";
    const escaped = String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return escaped
        .split(/\r?\n\r?\n/)
        .map((p) => `<p>${p.replace(/\r?\n/g, "<br/>")}</p>`)
        .join("");
};

const emailInvoiceTicketsController = async (req, res) => {
    const models = req.app.locals.models;
    try {
        const { invoice_uuid, order_uuid, to, subject, body } = req.body || {};
        if (!invoice_uuid) return res.status(400).json({ status: 400, data: { message: "invoice_uuid required" } });
        if (!to) return res.status(400).json({ status: 400, data: { message: "to (email) required" } });

        const tasks = [buildInvoicePdfBuffer({ models, invoice_uuid })];
        if (order_uuid) tasks.push(buildTicketsPdfBuffer({ TicketsModel: models.TicketsModel, order_uuid }));
        const [invoicePdf, ticketsPdf] = await Promise.all(tasks);

        const attachments = [];
        if (invoicePdf) {
            attachments.push({
                filename: `racun-${invoice_uuid.slice(0, 8)}.pdf`,
                content: invoicePdf.toString("base64"),
                contentType: "application/pdf",
            });
        }
        if (ticketsPdf) {
            attachments.push({
                filename: `karte-${(order_uuid || "").slice(0, 8)}.pdf`,
                content: ticketsPdf.toString("base64"),
                contentType: "application/pdf",
            });
        }

        const resend = new Resend(API_KEY);
        const result = await resend.emails.send({
            from: FROM,
            to,
            subject: subject || "Karte za vaše putovanje",
            html: textToHtml(body) || "<p>Vaše karte i račun se nalaze u privitku.</p>",
            attachments,
        });

        if (result?.error) {
            console.log("emailInvoiceTicketsController resend error:", result.error);
            return res.status(500).json({ status: 500, data: { message: result.error?.message || "email send failed" } });
        }

        return res.status(200).json({
            status: 200,
            data: { message: "Email sent", id: result?.data?.id, to },
        });
    } catch (error) {
        console.log("emailInvoiceTicketsController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { emailInvoiceTicketsController };
