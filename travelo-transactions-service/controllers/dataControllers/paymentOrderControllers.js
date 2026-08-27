const crypto = require("crypto");
const axios = require("axios");
const { Op, fn, col } = require("sequelize");
const { provjeriIban, normalizirajIban } = require("../../helpers/iban");
const { gradiPain001, imeDatoteke } = require("../../helpers/sepaXml");
const { getCoreServiceConfigData } = require("../configSyncController");

// Platni nalozi — povrati kupcu, grupirani po tome kome se predaju:
// SEPA (banci) ili kartičarskoj kući (MONRI, OTP_POS, SEVENPAY).
// Vidi dbModels/paymentOrders.models.js za odnos nalog → stavke.

const PROVIDERI = ["SEPA", "MONRI", "OTP_POS", "SEVENPAY"];
const jeSepa = (p) => String(p || "SEPA").toUpperCase() === "SEPA";

const tijelo = (req) => (req.body && typeof req.body.body === "object" && req.body.body !== null)
    ? req.body.body
    : (req.body || {});

// GET /payment_orders?status=open|closed|all&provider=SEPA|MONRI|...
const listPaymentOrdersController = async (req, res) => {
    const { PaymentOrderModel, PaymentOrderItemModel } = req.app.locals.models;
    try {
        const status = String(req.query.status || "all").toLowerCase();
        const provider = String(req.query.provider || "").toUpperCase();
        const where = {};
        if (status === "open" || status === "closed") where.status = status;
        if (PROVIDERI.includes(provider)) where.provider = provider;

        const nalozi = await PaymentOrderModel.findAll({ where, order: [["createdAt", "DESC"]] });
        const uuidi = nalozi.map((n) => n.payment_order_uuid);

        const zbrojevi = uuidi.length
            ? await PaymentOrderItemModel.findAll({
                where: { payment_order_uuid: { [Op.in]: uuidi } },
                attributes: [
                    "payment_order_uuid",
                    [fn("COUNT", col("id")), "broj"],
                    [fn("SUM", col("amount")), "zbroj"],
                ],
                group: ["payment_order_uuid"],
                raw: true,
            })
            : [];
        const poNalogu = new Map(zbrojevi.map((z) => [z.payment_order_uuid, z]));

        const orders = nalozi.map((n) => {
            const z = poNalogu.get(n.payment_order_uuid) || {};
            return {
                ...n.toJSON(),
                items_count: Number(z.broj || 0),
                total_amount: +Number(z.zbroj || 0).toFixed(2),
            };
        });

        res.status(200).json({ status: 200, data: { orders, total: orders.length } });
    } catch (error) {
        console.log("listPaymentOrdersController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// GET /payment_order/:payment_order_uuid
const getPaymentOrderController = async (req, res) => {
    const { PaymentOrderModel, PaymentOrderItemModel } = req.app.locals.models;
    try {
        const nalog = await PaymentOrderModel.findOne({ where: { payment_order_uuid: req.params.payment_order_uuid } });
        if (!nalog) return res.status(404).json({ status: 404, data: { message: "nalog ne postoji" } });

        const stavke = await PaymentOrderItemModel.findAll({
            where: { payment_order_uuid: nalog.payment_order_uuid },
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
        console.log("getPaymentOrderController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /payment_orders { name, provider, created_by, note }
const createPaymentOrderController = async (req, res) => {
    const { PaymentOrderModel } = req.app.locals.models;
    try {
        const data = tijelo(req);
        const name = String(data.name || "").trim();
        if (!name) return res.status(400).json({ status: 400, data: { message: "naziv naloga je obavezan" } });

        const provider = String(data.provider || "SEPA").toUpperCase();
        if (!PROVIDERI.includes(provider)) {
            return res.status(400).json({ status: 400, data: { message: `nepoznat provider ${provider}` } });
        }

        const nalog = await PaymentOrderModel.create({
            payment_order_uuid: data.payment_order_uuid || crypto.randomUUID(),
            provider,
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
        console.log("createPaymentOrderController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /payment_order_status { payment_order_uuid, status: open|closed, by }
// Nalog se zatvara kad je predan. Ponovno otvaranje je namjerno moguće — dok
// nalog nije stvarno poslan, greška u stavkama mora se moći ispraviti.
const setPaymentOrderStatusController = async (req, res) => {
    const { PaymentOrderModel } = req.app.locals.models;
    try {
        const data = tijelo(req);
        const status = String(data.status || "").toLowerCase();
        if (!["open", "closed"].includes(status)) {
            return res.status(400).json({ status: 400, data: { message: "status mora biti open ili closed" } });
        }
        const nalog = await PaymentOrderModel.findOne({ where: { payment_order_uuid: data.payment_order_uuid } });
        if (!nalog) return res.status(404).json({ status: 404, data: { message: "nalog ne postoji" } });

        await nalog.update(status === "closed"
            ? { status, closed_at: new Date(), closed_by: data.by || null }
            : { status, closed_at: null, closed_by: null });

        res.status(200).json({ status: 200, data: { order: nalog.toJSON() } });
    } catch (error) {
        console.log("setPaymentOrderStatusController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// Zajednički put za dodavanje stavke — koristi ga i ruta i storno, pa provjere
// stoje na jednom mjestu. Što je obavezno ovisi o provideru: SEPA traži
// primatelja i IBAN, kartični povrat trag izvorne transakcije.
const dodajStavku = async (models, data) => {
    const { PaymentOrderModel, PaymentOrderItemModel } = models;

    const nalog = await PaymentOrderModel.findOne({ where: { payment_order_uuid: data.payment_order_uuid } });
    if (!nalog) return { status: 404, body: { message: "nalog ne postoji" } };
    if (nalog.status !== "open") return { status: 409, body: { message: "nalog je zatvoren" } };

    const amount = Math.abs(Number(data.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
        return { status: 400, body: { message: "iznos mora biti veći od nule" } };
    }

    const zapis = {
        payment_item_uuid: data.payment_item_uuid || crypto.randomUUID(),
        payment_order_uuid: nalog.payment_order_uuid,
        provider: nalog.provider,
        amount: +amount.toFixed(2),
        storno_invoice_uuid: data.storno_invoice_uuid || null,
        storno_invoice_code: data.storno_invoice_code || null,
        ticket_uuids: Array.isArray(data.ticket_uuids) ? data.ticket_uuids.join(",") : (data.ticket_uuids || null),
        ticket_codes: Array.isArray(data.ticket_codes) ? data.ticket_codes.join(",") : (data.ticket_codes || null),
        description: data.description || null,
        created_by: data.created_by || null,
    };

    if (jeSepa(nalog.provider)) {
        const recipient_name = String(data.recipient_name || "").trim();
        if (!recipient_name) return { status: 400, body: { message: "naziv primatelja je obavezan" } };
        const provjera = provjeriIban(data.recipient_iban);
        if (!provjera.ok) return { status: 400, body: { message: `IBAN nije ispravan — ${provjera.razlog}` } };
        zapis.recipient_name = recipient_name;
        zapis.recipient_iban = provjera.iban;
    } else {
        // Kartičarska kuća povrat provodi po izvornoj transakciji. Bez ijednog
        // traga (autorizacije, terminala ili reference) nalog joj ne znači
        // ništa, pa se takva stavka ne prima.
        zapis.card_mask = data.card_mask || null;
        zapis.card_type = data.card_type || null;
        zapis.auth_code = data.auth_code || null;
        zapis.terminal_id = data.terminal_id || null;
        zapis.transaction_reference = data.transaction_reference || null;
        zapis.transaction_date = data.transaction_date || null;
        zapis.original_invoice_uuid = data.original_invoice_uuid || null;
        zapis.original_invoice_no = data.original_invoice_no || null;
        if (!zapis.auth_code && !zapis.transaction_reference && !zapis.terminal_id) {
            return { status: 400, body: { message: "nema podataka o izvornoj kartičnoj transakciji" } };
        }
    }

    const stavka = await PaymentOrderItemModel.create(zapis);
    return { status: 200, body: { item: stavka.toJSON() } };
};

// POST /payment_order_items
const addPaymentOrderItemController = async (req, res) => {
    try {
        const { status, body } = await dodajStavku(req.app.locals.models, tijelo(req));
        res.status(status).json({ status, data: body });
    } catch (error) {
        console.log("addPaymentOrderItemController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /payment_order_item_delete { payment_item_uuid }
// Stavka se briše samo dok je nalog otvoren — nakon predaje evidencija mora
// odgovarati onome što je poslano.
const deletePaymentOrderItemController = async (req, res) => {
    const { PaymentOrderModel, PaymentOrderItemModel } = req.app.locals.models;
    try {
        const data = tijelo(req);
        const stavka = await PaymentOrderItemModel.findOne({ where: { payment_item_uuid: data.payment_item_uuid } });
        if (!stavka) return res.status(404).json({ status: 404, data: { message: "stavka ne postoji" } });

        const nalog = await PaymentOrderModel.findOne({ where: { payment_order_uuid: stavka.payment_order_uuid } });
        if (nalog && nalog.status !== "open") {
            return res.status(409).json({ status: 409, data: { message: "nalog je zatvoren" } });
        }

        await stavka.destroy();
        res.status(200).json({ status: 200, data: { deleted: data.payment_item_uuid } });
    } catch (error) {
        console.log("deletePaymentOrderItemController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// GET /payment_order_xml/:payment_order_uuid?execution_date=YYYY-MM-DD
// Datoteka za uvoz u e-bankarstvo (pain.001.001.03) — samo za SEPA naloge.
// Kartični se predaju izvještajem, koji slaže portal.
const paymentOrderXmlController = async (req, res) => {
    const { PaymentOrderModel, PaymentOrderItemModel } = req.app.locals.models;
    try {
        const nalog = await PaymentOrderModel.findOne({ where: { payment_order_uuid: req.params.payment_order_uuid } });
        if (!nalog) return res.status(404).json({ status: 404, data: { message: "nalog ne postoji" } });
        if (!jeSepa(nalog.provider)) {
            return res.status(400).json({
                status: 400,
                data: { message: "SEPA datoteka postoji samo za naloge povrata na račun" },
            });
        }

        // Samo iz zatvorenog naloga: dok je otvoren u njega još ulaze stavke,
        // pa bi se banci predala datoteka koja ne odgovara nalogu.
        if (nalog.status !== "closed") {
            return res.status(400).json({
                status: 400,
                data: { message: "nalog mora biti zatvoren da bi se datoteka mogla preuzeti" },
            });
        }

        const stavke = await PaymentOrderItemModel.findAll({
            where: { payment_order_uuid: nalog.payment_order_uuid },
            order: [["createdAt", "ASC"]],
        });
        if (!stavke.length) {
            return res.status(400).json({ status: 400, data: { message: "nalog nema stavki" } });
        }

        const coreConfig = await getCoreServiceConfigData();
        const backofficeUrl = coreConfig?.services?.backoffice?.url;
        if (!backofficeUrl) throw new Error("backoffice URL missing in core config");
        // Udaljena baza zna biti spora, a 5 sekundi je premalo pa generiranje
        // padne na isteku veze.
        const companyResp = await axios.get(`${backofficeUrl}/company`, { timeout: 20000, validateStatus: () => true });
        const company = companyResp.data?.data?.company || {};

        if (!company.iban) {
            return res.status(400).json({
                status: 400,
                data: { message: "na tvrtki nije upisan IBAN — upiši ga u Backoffice → Tvrtka" },
            });
        }
        const provjera = provjeriIban(company.iban);
        if (!provjera.ok) {
            return res.status(400).json({
                status: 400,
                data: { message: `IBAN tvrtke nije ispravan — ${provjera.razlog}` },
            });
        }

        const now = new Date();
        const xml = gradiPain001({
            company,
            order: { ...nalog.toJSON(), sepa_order_uuid: nalog.payment_order_uuid },
            items: stavke.map((s) => ({ ...s.toJSON(), sepa_item_uuid: s.payment_item_uuid })),
            now,
            executionDate: req.query.execution_date || null,
        });

        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${imeDatoteke(nalog, now)}"`);
        res.status(200).send(xml);
    } catch (error) {
        console.log("paymentOrderXmlController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    listPaymentOrdersController,
    getPaymentOrderController,
    createPaymentOrderController,
    setPaymentOrderStatusController,
    addPaymentOrderItemController,
    deletePaymentOrderItemController,
    paymentOrderXmlController,
    dodajStavku,
    normalizirajIban,
    PROVIDERI,
};
