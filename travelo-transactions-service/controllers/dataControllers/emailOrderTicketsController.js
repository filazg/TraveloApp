const { Resend } = require("resend");
const { buildTicketsPdfBuffer } = require("./ticketPdfController");

// Kljuc dolazi iz okoline (pm2 env na VM-u, vidi ecosystem.config.js).
const API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.RESEND_FROM || "Kapetan Luka <noreply@tech4beez.com>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const html = (lang) => (lang === "en"
    ? `<p>Hello,</p>
       <p>Your tickets are attached to this email.</p>
       <p>Please present the tickets when boarding the vessel. You can print them in A4 format or show them on your mobile device.</p>
       <p>The QR code is unique and valid only for the first scan!</p>
       <p>Have calm seas!</p>
       <p><em>This email was generated automatically — replies are not monitored.</em></p>`
    : `<p>Pozdrav,</p>
       <p>Vaše karte se nalaze u privitku ovog e-maila.</p>
       <p>Karte ste dužni predočiti prilikom ukrcaja na brod. Karte možete isprintati u A4 formatu ili predočiti na mobilnom uređaju.</p>
       <p>QR kod je jedinstven i vrijedi samo prilikom prvog skeniranja!</p>
       <p>Mirno more!</p>
       <p><em>E-mail poruka je generirana automatski i odgovor na nju nije moguć.</em></p>`);

// Karte jedne narudzbe e-mailom putniku, bez racuna (partnerska prodaja nema
// racun po karti). Tko smije slati provjerava pozivatelj (sales servis).
const emailOrderTicketsController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const { order_uuid, to, channel = "PARTNER", lang = "hr" } = req.body || {};
        if (!order_uuid) return res.status(400).json({ status: 400, data: { message: "order_uuid required" } });
        if (!EMAIL_RE.test(String(to || "").trim())) {
            return res.status(400).json({ status: 400, data: { message: "Neispravna e-mail adresa." } });
        }
        if (!API_KEY) {
            console.log("mail nije poslan: RESEND_API_KEY nije postavljen u okolini");
            return res.status(503).json({ status: 503, data: { message: "Slanje e-pošte nije podešeno." } });
        }

        const pdf = await buildTicketsPdfBuffer({ TicketsModel, order_uuid, channel });
        if (!pdf) return res.status(404).json({ status: 404, data: { message: "Nema karata uz ovu rezervaciju." } });

        const result = await new Resend(API_KEY).emails.send({
            from: FROM,
            to: String(to).trim(),
            subject: lang === "en" ? "Kapetan Luka - Your tickets" : "Kapetan Luka - Vaše karte",
            html: html(lang),
            attachments: [{
                filename: lang === "en" ? "tickets.pdf" : "karte.pdf",
                content: pdf.toString("base64"),
                contentType: "application/pdf",
            }],
        });
        if (result?.error) {
            console.log("emailOrderTicketsController resend error:", result.error);
            return res.status(502).json({ status: 502, data: { message: result.error?.message || "Slanje nije uspjelo." } });
        }
        return res.status(200).json({ status: 200, data: { message: "Email sent", id: result?.data?.id, to } });
    } catch (error) {
        console.log("emailOrderTicketsController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { emailOrderTicketsController };
