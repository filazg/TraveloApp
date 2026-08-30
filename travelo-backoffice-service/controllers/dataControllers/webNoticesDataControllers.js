const crypto = require("crypto");
const { Op } = require("sequelize");
const { getSequelize } = require("../../config/database");

const sequelize = getSequelize();

const RAZINE = ["info", "warning", "urgent"];

// Prazan unos je "bez granice", a ne danasnji datum — obavijest bez kraja
// vrijedi dok je netko ne ugasi.
const uDatum = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const provjeri = (data) => {
    if (!String(data?.title || "").trim()) return "naslov je obavezan";
    if (!String(data?.text || "").trim()) return "tekst obavijesti je obavezan";
    if (data?.severity && !RAZINE.includes(data.severity)) return "nepoznata razina obavijesti";
    const od = uDatum(data?.valid_from);
    const doo = uDatum(data?.valid_to);
    if (od && doo && doo < od) return "kraj prikaza je prije pocetka";
    return null;
};

// Portal vidi sve obavijesti, i one koje su prosle — po njima se vidi sto je
// bilo objavljeno.
const getWebNoticesDataController = async (req, res) => {
    const { WebNoticesModel } = req.app.locals.models;
    try {
        const notices = await WebNoticesModel.findAll({
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["id", "DESC"]],
        });
        res.send({ status: 200, data: { web_notices: notices } });
    } catch (error) {
        console.log("getWebNoticesDataController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Ono sto stranica stvarno prikazuje: aktivne obavijesti kojima je danasnji
// trenutak unutar razdoblja prikaza. Filtrira se ovdje, a ne na stranici — inace
// bi svaki potrosac tog podatka morao ponoviti isto pravilo.
const getActiveWebNoticesDataController = async (req, res) => {
    const { WebNoticesModel } = req.app.locals.models;
    try {
        const sada = new Date();
        const notices = await WebNoticesModel.findAll({
            where: {
                is_active: true,
                [Op.and]: [
                    { [Op.or]: [{ valid_from: null }, { valid_from: { [Op.lte]: sada } }] },
                    { [Op.or]: [{ valid_to: null }, { valid_to: { [Op.gte]: sada } }] },
                ],
            },
            attributes: ["uuid", "title", "text", "severity", "valid_from", "valid_to"],
            order: [["id", "DESC"]],
        });
        res.send({ status: 200, data: { web_notices: notices } });
    } catch (error) {
        console.log("getActiveWebNoticesDataController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const addWebNoticeDataController = async (req, res) => {
    const { WebNoticesModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body;
        const greska = provjeri(data);
        if (greska) return res.status(400).send({ status: 400, data: { message: greska } });

        await sequelize.transaction(async () => {
            await WebNoticesModel.create({
                uuid: crypto.randomUUID(),
                title: String(data.title).trim(),
                text: String(data.text).trim(),
                severity: data.severity || "info",
                valid_from: uDatum(data.valid_from),
                valid_to: uDatum(data.valid_to),
                is_active: data.is_active !== false,
                updated_by_username: data.updated_by_username || req.body?.user?.username || null,
            });
            res.send({ status: 201 });
        });
    } catch (error) {
        console.log("addWebNoticeDataController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const updateWebNoticeDataController = async (req, res) => {
    const { WebNoticesModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body;
        if (!data?.uuid) return res.status(400).send({ status: 400, data: { message: "uuid je obavezan" } });

        const obavijest = await WebNoticesModel.findOne({ where: { uuid: data.uuid } });
        if (!obavijest) return res.status(404).send({ status: 404, data: { message: "obavijest ne postoji" } });

        // Gasenje i paljenje salje samo `is_active`; tada se sadrzaj ne dira.
        const samoStatus = Object.keys(data).every((k) => k === "uuid" || k === "is_active");
        if (!samoStatus) {
            const greska = provjeri({ ...obavijest.get(), ...data });
            if (greska) return res.status(400).send({ status: 400, data: { message: greska } });
        }

        const izmjena = { updated_by_username: data.updated_by_username || null };
        if (data.title !== undefined) izmjena.title = String(data.title).trim();
        if (data.text !== undefined) izmjena.text = String(data.text).trim();
        if (data.severity !== undefined) izmjena.severity = data.severity;
        if (data.valid_from !== undefined) izmjena.valid_from = uDatum(data.valid_from);
        if (data.valid_to !== undefined) izmjena.valid_to = uDatum(data.valid_to);
        if (data.is_active !== undefined) izmjena.is_active = data.is_active === true;

        await sequelize.transaction(async () => {
            await WebNoticesModel.update(izmjena, { where: { uuid: data.uuid } });
            res.send({ status: 201 });
        });
    } catch (error) {
        console.log("updateWebNoticeDataController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    getWebNoticesDataController,
    getActiveWebNoticesDataController,
    addWebNoticeDataController,
    updateWebNoticeDataController,
};
