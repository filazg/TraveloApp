const crypto = require("crypto");
const { Op, fn, col } = require("sequelize");
const { provjeriIban, normalizirajIban } = require("../../helpers/iban");

// SEPA nalozi — evidencija povrata koji idu na račun umjesto u gotovinu.
// Vidi dbModels/sepa.models.js za odnos nalog → stavke.

const tijelo = (req) => (req.body && typeof req.body.body === "object" && req.body.body !== null)
    ? req.body.body
    : (req.body || {});

// GET /sepa_orders?status=open|closed|all
// Uz svaki nalog ide broj stavki i zbroj iznosa — popis se gleda upravo zbog
// toga, pa nema smisla tjerati klijenta na dodatni poziv po nalogu.
const listSepaOrdersController = async (req, res) => {
    const { SepaOrderModel, SepaOrderItemModel } = req.app.locals.models;
    try {
        const status = String(req.query.status || "all").toLowerCase();
        const where = {};
        if (status === "open" || status === "closed") where.status = status;

        const nalozi = await SepaOrderModel.findAll({ where, order: [["createdAt", "DESC"]] });
        const uuidi = nalozi.map((n) => n.sepa_order_uuid);

        const zbrojevi = uuidi.length
            ? await SepaOrderItemModel.findAll({
                where: { sepa_order_uuid: { [Op.in]: uuidi } },
                attributes: [
                    "sepa_order_uuid",
                    [fn("COUNT", col("id")), "broj"],
                    [fn("SUM", col("amount")), "zbroj"],
                ],
                group: ["sepa_order_uuid"],
                raw: true,
            })
            : [];
        const poNalogu = new Map(zbrojevi.map((z) => [z.sepa_order_uuid, z]));

        const orders = nalozi.map((n) => {
            const z = poNalogu.get(n.sepa_order_uuid) || {};
            return {
                ...n.toJSON(),
                items_count: Number(z.broj || 0),
                total_amount: +Number(z.zbroj || 0).toFixed(2),
            };
        });

        res.status(200).json({ status: 200, data: { orders, total: orders.length } });
    } catch (error) {
        console.log("listSepaOrdersController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// GET /sepa_order/:sepa_order_uuid
const getSepaOrderController = async (req, res) => {
    const { SepaOrderModel, SepaOrderItemModel } = req.app.locals.models;
    try {
        const nalog = await SepaOrderModel.findOne({ where: { sepa_order_uuid: req.params.sepa_order_uuid } });
        if (!nalog) return res.status(404).json({ status: 404, data: { message: "nalog ne postoji" } });

        const stavke = await SepaOrderItemModel.findAll({
            where: { sepa_order_uuid: nalog.sepa_order_uuid },
            order: [["createdAt", "ASC"]],
        });
        const total = stavke.reduce((z, s) => z + Number(s.amount || 0), 0);

        res.status(200).json({
            status: 200,
            data: {
                order: { ...nalog.toJSON(), items_count: stavke.length, total_amount: +total.toFixed(2) },
                items: stavke.map((s) => s.toJSON()),
            },
        });
    } catch (error) {
        console.log("getSepaOrderController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /sepa_orders { name, created_by, note }
const createSepaOrderController = async (req, res) => {
    const { SepaOrderModel } = req.app.locals.models;
    try {
        const data = tijelo(req);
        const name = String(data.name || "").trim();
        if (!name) return res.status(400).json({ status: 400, data: { message: "naziv naloga je obavezan" } });

        const nalog = await SepaOrderModel.create({
            sepa_order_uuid: data.sepa_order_uuid || crypto.randomUUID(),
            name,
            status: "open",
            created_by: data.created_by || null,
            note: data.note || null,
        });

        res.status(200).json({
            status: 200,
            data: { order: { ...nalog.toJSON(), items_count: 0, total_amount: 0 } },
        });
    } catch (error) {
        console.log("createSepaOrderController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /sepa_order_status { sepa_order_uuid, status: open|closed, by }
// Nalog se zatvara kad je predan banci. Ponovno otvaranje je namjerno moguće —
// dok nalog nije stvarno poslan, greška u stavkama mora se moći ispraviti.
const setSepaOrderStatusController = async (req, res) => {
    const { SepaOrderModel } = req.app.locals.models;
    try {
        const data = tijelo(req);
        const status = String(data.status || "").toLowerCase();
        if (!["open", "closed"].includes(status)) {
            return res.status(400).json({ status: 400, data: { message: "status mora biti open ili closed" } });
        }
        const nalog = await SepaOrderModel.findOne({ where: { sepa_order_uuid: data.sepa_order_uuid } });
        if (!nalog) return res.status(404).json({ status: 404, data: { message: "nalog ne postoji" } });

        await nalog.update(status === "closed"
            ? { status, closed_at: new Date(), closed_by: data.by || null }
            : { status, closed_at: null, closed_by: null });

        res.status(200).json({ status: 200, data: { order: nalog.toJSON() } });
    } catch (error) {
        console.log("setSepaOrderStatusController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// Zajednički put za dodavanje stavke — koristi ga i ruta i storno, pa provjere
// stoje na jednom mjestu.
const dodajStavku = async (models, data) => {
    const { SepaOrderModel, SepaOrderItemModel } = models;

    const nalog = await SepaOrderModel.findOne({ where: { sepa_order_uuid: data.sepa_order_uuid } });
    if (!nalog) return { status: 404, body: { message: "nalog ne postoji" } };
    if (nalog.status !== "open") return { status: 409, body: { message: "nalog je zatvoren" } };

    const recipient_name = String(data.recipient_name || "").trim();
    if (!recipient_name) return { status: 400, body: { message: "naziv primatelja je obavezan" } };

    const provjera = provjeriIban(data.recipient_iban);
    if (!provjera.ok) return { status: 400, body: { message: `IBAN nije ispravan — ${provjera.razlog}` } };

    const amount = Math.abs(Number(data.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
        return { status: 400, body: { message: "iznos mora biti veći od nule" } };
    }

    const stavka = await SepaOrderItemModel.create({
        sepa_item_uuid: data.sepa_item_uuid || crypto.randomUUID(),
        sepa_order_uuid: nalog.sepa_order_uuid,
        recipient_name,
        recipient_iban: provjera.iban,
        amount: +amount.toFixed(2),
        storno_invoice_uuid: data.storno_invoice_uuid || null,
        storno_invoice_code: data.storno_invoice_code || null,
        ticket_uuids: Array.isArray(data.ticket_uuids) ? data.ticket_uuids.join(",") : (data.ticket_uuids || null),
        ticket_codes: Array.isArray(data.ticket_codes) ? data.ticket_codes.join(",") : (data.ticket_codes || null),
        description: data.description || null,
        created_by: data.created_by || null,
    });

    return { status: 200, body: { item: stavka.toJSON() } };
};

// POST /sepa_order_items
const addSepaOrderItemController = async (req, res) => {
    try {
        const { status, body } = await dodajStavku(req.app.locals.models, tijelo(req));
        res.status(status).json({ status, data: body });
    } catch (error) {
        console.log("addSepaOrderItemController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /sepa_order_item_delete { sepa_item_uuid }
// Stavka se briše samo dok je nalog otvoren — nakon predaje banci evidencija
// mora odgovarati onome što je poslano.
const deleteSepaOrderItemController = async (req, res) => {
    const { SepaOrderModel, SepaOrderItemModel } = req.app.locals.models;
    try {
        const data = tijelo(req);
        const stavka = await SepaOrderItemModel.findOne({ where: { sepa_item_uuid: data.sepa_item_uuid } });
        if (!stavka) return res.status(404).json({ status: 404, data: { message: "stavka ne postoji" } });

        const nalog = await SepaOrderModel.findOne({ where: { sepa_order_uuid: stavka.sepa_order_uuid } });
        if (nalog && nalog.status !== "open") {
            return res.status(409).json({ status: 409, data: { message: "nalog je zatvoren" } });
        }

        await stavka.destroy();
        res.status(200).json({ status: 200, data: { deleted: data.sepa_item_uuid } });
    } catch (error) {
        console.log("deleteSepaOrderItemController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    listSepaOrdersController,
    getSepaOrderController,
    createSepaOrderController,
    setSepaOrderStatusController,
    addSepaOrderItemController,
    deleteSepaOrderItemController,
    dodajStavku,
    normalizirajIban,
};
