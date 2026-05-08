const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");
const { sendDispatcherEmail } = require("../../helpers/dispatcherEmail");

async function callSalesCancelRoutes(route_uuids) {
    const coreConfig = await getCoreServiceConfigData();
    const salesUrl = coreConfig?.services?.sales?.url;
    if (!salesUrl) throw new Error("sales service URL missing");
    const resp = await axios.patch(`${salesUrl}/routes/cancel_batch`, { route_uuids }, {
        timeout: 10000,
        validateStatus: () => true,
    });
    return resp.data?.data?.affected ?? 0;
}

async function collectPassengerEmails(TicketsModel, route_uuids) {
    const tickets = await TicketsModel.findAll({
        where: {
            route_uuid: { [Op.in]: route_uuids },
            [Op.or]: [{ is_canceled: false }, { is_canceled: null }],
        },
        attributes: ["ticket_uuid", "passanger_email", "passanger_name"],
    });
    const emails = new Set();
    for (const t of tickets) {
        const e = (t.passanger_email || "").trim();
        if (e) emails.add(e);
    }
    return { tickets, emails: Array.from(emails) };
}

const cancelSailingController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        // Gateway omota tijelo u { header, body } kad je is_login=false. Body
        // payload-a ima ime "body" (tekst poruke), pa unwrap-amo SAMO ako je
        // req.body.body objekt (gateway wrap), inače je tekst poruke.
        const data = (req.body && typeof req.body.body === "object" && req.body.body !== null)
            ? req.body.body
            : (req.body || {});
        const { route_uuids, subject, body, sailing } = data;
        if (!Array.isArray(route_uuids) || !route_uuids.length) {
            return res.status(400).json({ status: 400, data: { message: "route_uuids required" } });
        }

        const affected = await callSalesCancelRoutes(route_uuids);

        const [ticketsAffected] = await TicketsModel.update(
            { is_canceled: true, status: "trip_canceled" },
            { where: { route_uuid: { [Op.in]: route_uuids } } }
        );

        const { emails } = await collectPassengerEmails(TicketsModel, route_uuids);
        const results = [];
        for (const email of emails) {
            const r = await sendDispatcherEmail({
                to: email,
                subject: subject || "Kapetan Luka — Polazak je otkazan",
                body: body || "Poštovani,\n\nObavještavamo Vas da je Vaš polazak otkazan.\n\nKapetan Luka",
                signature: "Služba za putnike · Kapetan Luka",
                sailing,
            });
            results.push({ email, ...r });
        }

        res.status(200).json({
            status: 200,
            data: {
                routes_canceled: affected,
                tickets_canceled: ticketsAffected || 0,
                emails_sent: results.filter((r) => r.ok).length,
                emails_total: results.length,
            },
        });
    } catch (error) {
        console.log("cancelSailingController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const sendSailingMessageController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        // Gateway omota tijelo u { header, body } kad je is_login=false. Body
        // payload-a ima ime "body" (tekst poruke), pa unwrap-amo SAMO ako je
        // req.body.body objekt (gateway wrap), inače je tekst poruke.
        const data = (req.body && typeof req.body.body === "object" && req.body.body !== null)
            ? req.body.body
            : (req.body || {});
        const { route_uuids, subject, body, sailing } = data;
        if (!Array.isArray(route_uuids) || !route_uuids.length) {
            return res.status(400).json({ status: 400, data: { message: "route_uuids required" } });
        }
        if (!subject || !body) {
            return res.status(400).json({ status: 400, data: { message: "subject and body required" } });
        }

        const { emails } = await collectPassengerEmails(TicketsModel, route_uuids);
        const results = [];
        for (const email of emails) {
            const r = await sendDispatcherEmail({
                to: email,
                subject,
                body,
                signature: "Služba za putnike · Kapetan Luka",
                sailing,
            });
            results.push({ email, ...r });
        }

        res.status(200).json({
            status: 200,
            data: {
                emails_sent: results.filter((r) => r.ok).length,
                emails_total: results.length,
            },
        });
    } catch (error) {
        console.log("sendSailingMessageController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { cancelSailingController, sendSailingMessageController };
