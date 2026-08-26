const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData, getChannelServiceConfigData } = require("../configSyncController");
const { sendDispatcherEmail } = require("../../helpers/dispatcherEmail");
const { pomakni } = require("../../helpers/voyageTime");

// Otkaz polaska mora stići na tri mjesta:
//   1. boat — matični vozni red. Bez njega otkaz nestane pri prvom idućem
//      sinkroniziranju voznog reda, jer se kopije brišu i pune odavde.
//   2. sales — kopija za blagajne (desk i mobilna).
//   3. web_sales — kopija za internetsku prodaju, koja ima svoj popis polazaka.
//
// Matični upis ide prvi i njegov neuspjeh prekida sve; kopije se javljaju
// pojedinačno, da se u odgovoru vidi ako jedna nije prošla. Prodaja se u tom
// slučaju zaustavi tek nakon sinkronizacije, pa dispečer mora znati.
async function propagirajOtkazRuta(route_uuids, otkazan) {
    const coreConfig = await getCoreServiceConfigData();
    const tijelo = { route_uuids, canceled: otkazan };
    const posalji = async (url, putanja) => {
        if (!url) return { ok: false, error: "URL servisa nije postavljen" };
        try {
            const resp = await axios.patch(`${url}${putanja}`, tijelo, {
                timeout: 10000,
                validateStatus: () => true,
            });
            const affected = resp.data?.data?.affected;
            if (resp.status !== 200 || affected === undefined) {
                return { ok: false, error: resp.data?.data?.message || `HTTP ${resp.status}` };
            }
            return { ok: true, affected };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    };

    const boat = await posalji(coreConfig?.services?.boat?.url, "/sales_routes/cancel_batch");
    if (!boat.ok) throw new Error(`vozni red nije azuriran: ${boat.error}`);

    const sales = await posalji(coreConfig?.services?.sales?.url, "/routes/cancel_batch");

    // Web prodaja je kanal, ne core servis, pa joj adresa dolazi iz drugog
    // configa. Adresa se slaze iz porta, jer `url` u konfiguraciji pokazuje na
    // 6040 (api servis), a servis slusa na `port`.
    const channelConfig = getChannelServiceConfigData();
    const webSalesPort = channelConfig?.services?.web_sales?.port;
    const webSales = await posalji(webSalesPort ? `http://localhost:${webSalesPort}` : null, "/routes/cancel_batch");

    return { boat, sales, web_sales: webSales };
}

// Pomak polaska. Matični servis izračuna razliku prema voznom redu i pomakne
// svoje rute i etape; kopijama se šalje gotova razlika, da isti račun ne
// postoji na tri mjesta.
async function propagirajPomakRuta(route_uuids, new_departure) {
    const coreConfig = await getCoreServiceConfigData();
    const posalji = async (url, putanja, tijelo) => {
        if (!url) return { ok: false, error: "URL servisa nije postavljen" };
        try {
            const resp = await axios.patch(`${url}${putanja}`, tijelo, {
                timeout: 15000,
                validateStatus: () => true,
            });
            if (resp.status !== 200 || resp.data?.data?.affected === undefined) {
                return { ok: false, error: resp.data?.data?.message || resp.data?.data?.error || `HTTP ${resp.status}` };
            }
            return { ok: true, ...resp.data.data };
        } catch (error) {
            return { ok: false, error: error?.message || String(error) };
        }
    };

    const boat = await posalji(
        coreConfig?.services?.boat?.url,
        "/sales_routes/reschedule_batch",
        { route_uuids, new_departure }
    );
    if (!boat.ok) throw new Error(`vozni red nije pomaknut: ${boat.error}`);

    const tijeloKopije = { route_uuids, delta_minutes: boat.delta_minutes };
    const sales = await posalji(coreConfig?.services?.sales?.url, "/routes/reschedule_batch", tijeloKopije);

    const channelConfig = getChannelServiceConfigData();
    const webSalesPort = channelConfig?.services?.web_sales?.port;
    const webSales = await posalji(
        webSalesPort ? `http://localhost:${webSalesPort}` : null,
        "/routes/reschedule_batch",
        tijeloKopije
    );

    return { boat, sales, web_sales: webSales };
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

        const rute = await propagirajOtkazRuta(route_uuids, true);

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
                routes_canceled: rute.boat.affected,
                routes_targets: rute,
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

// POST /restore_sailing — body: { route_uuids: [] }
//
// Vraća polazak u prodaju nakon pogrešnog otkaza. Karte se NE vraćaju: putnici
// su već dobili obavijest o otkazu, a dio ih je mogao dobiti i povrat novca, pa
// bi oživljavanje karte značilo da putnik ima važeću kartu koju nije platio.
// Njih se, ako treba, prodaje ponovno.
const restoreSailingController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const data = (req.body && typeof req.body.body === "object" && req.body.body !== null)
            ? req.body.body
            : (req.body || {});
        const { route_uuids } = data;
        if (!Array.isArray(route_uuids) || !route_uuids.length) {
            return res.status(400).json({ status: 400, data: { message: "route_uuids required" } });
        }

        const rute = await propagirajOtkazRuta(route_uuids, false);

        // Koliko karata ostaje otkazano — dispečer to treba vidjeti, jer polazak
        // se vraća u prodaju s praznim brojem putnika.
        const ticketsStillCanceled = await TicketsModel.count({
            where: { route_uuid: { [Op.in]: route_uuids }, status: "trip_canceled" },
        });

        res.status(200).json({
            status: 200,
            data: {
                routes_restored: rute.boat.affected,
                routes_targets: rute,
                tickets_still_canceled: ticketsStillCanceled,
            },
        });
    } catch (error) {
        console.log("restoreSailingController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /reschedule_sailing
// body: { route_uuids: [], new_departure: "DD.MM.YYYY. HH:mm" | null, subject, body, sailing }
//
// Pomak polaska na novi datum i vrijeme. Planirano vrijeme (vozni red i ono
// otisnuto na karti) ostaje netaknuto — mijenja se samo aktualno. Karte se
// pomiču zajedno s polaskom da validacija na terminalu ne javlja nepodudaranje
// vremena; putniku u ruci ostaje papir sa starim vremenom, zato i ide e-mail.
//
// `new_departure: null` vraća polazak na vozni red.
const rescheduleSailingController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const data = (req.body && typeof req.body.body === "object" && req.body.body !== null)
            ? req.body.body
            : (req.body || {});
        const { route_uuids, new_departure, subject, body, sailing } = data;
        if (!Array.isArray(route_uuids) || !route_uuids.length) {
            return res.status(400).json({ status: 400, data: { message: "route_uuids required" } });
        }

        const rute = await propagirajPomakRuta(route_uuids, new_departure || null);
        const delta = rute.boat.delta_minutes || 0;

        // Karte: planirano ostaje, aktualno se pomiče za istu razliku.
        const karte = await TicketsModel.findAll({
            where: {
                route_uuid: { [Op.in]: route_uuids },
                [Op.or]: [{ is_canceled: false }, { is_canceled: null }],
            },
        });
        for (const k of karte) {
            await k.update({
                departure: pomakni(k.departure_planed, delta),
                arrival: pomakni(k.arrival_planed, delta),
            });
        }

        const { emails } = await collectPassengerEmails(TicketsModel, route_uuids);
        const results = [];
        for (const email of emails) {
            const r = await sendDispatcherEmail({
                to: email,
                subject: subject || "Kapetan Luka — Promjena vremena polaska",
                body: body || `Poštovani,\n\nObavještavamo Vas da je Vaš polazak pomaknut na ${rute.boat.new_departure}.\n\nKapetan Luka`,
                signature: "Služba za putnike · Kapetan Luka",
                sailing,
            });
            results.push({ email, ...r });
        }

        res.status(200).json({
            status: 200,
            data: {
                delta_minutes: delta,
                planned_departure: rute.boat.planned_departure,
                new_departure: rute.boat.new_departure,
                routes_moved: rute.boat.affected,
                departures_moved: rute.boat.affected_departures,
                routes_targets: rute,
                tickets_moved: karte.length,
                emails_sent: results.filter((r) => r.ok).length,
                emails_total: results.length,
            },
        });
    } catch (error) {
        console.log("rescheduleSailingController error:", error?.message || error);
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

module.exports = { cancelSailingController, restoreSailingController, rescheduleSailingController, sendSailingMessageController };
