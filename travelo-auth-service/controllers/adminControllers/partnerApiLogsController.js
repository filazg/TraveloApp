// Log spajanja partnera preko API-ja — upis (zove channel-api, fire-and-forget)
// i čitanje (zove web_portal-service, pristup samo za admina).

const { Op } = require("sequelize");

// Zapisi se drže 3 mjeseca, kao i log prijava. Čišćenje ide najviše jednom
// na sat, uz upis — bez zasebnog rasporeda.
const ZADRZI_MJESECI = 3;
const CISCENJE_MS = 60 * 60 * 1000;
let zadnjeCiscenje = 0;

const ocisti = async (PartnerApiLogsModel) => {
    if (Date.now() - zadnjeCiscenje < CISCENJE_MS) return;
    zadnjeCiscenje = Date.now();
    const granica = new Date();
    granica.setMonth(granica.getMonth() - ZADRZI_MJESECI);
    await PartnerApiLogsModel.destroy({ where: { createdAt: { [Op.lt]: granica } } });
};

// Naziv partnera nije u tokenu — čita se iz partners_api_users. Šifarnik je
// malen i rijetko se mijenja, pa se drži u memoriji 10 minuta.
let partneri = null;
let partneriU = 0;
const nadjiPartnera = async (PartnersApiUsersModel, { api_user_uuid, tid }) => {
    if (!partneri || Date.now() - partneriU > 10 * 60 * 1000) {
        const redovi = await PartnersApiUsersModel.findAll({
            attributes: ["uuid", "tid", "partner_uuid", "partner_acr", "partner_name"],
            raw: true,
        });
        partneri = redovi;
        partneriU = Date.now();
    }
    return partneri.find((p) => (api_user_uuid && p.uuid === api_user_uuid) || (tid && String(p.tid) === String(tid))) || null;
};

const rez = (v, n) => (v == null ? null : String(v).slice(0, n));

// POST — jedan zapis po zahtjevu partnera.
const createPartnerApiLogController = async (req, res) => {
    try {
        const { PartnerApiLogsModel, PartnersApiUsersModel } = req.app.locals.models;
        const z = req.body?.body || req.body || {};
        const partner = await nadjiPartnera(PartnersApiUsersModel, z).catch(() => null);
        await PartnerApiLogsModel.create({
            method: rez(z.method, 10),
            path: rez(z.path, 255),
            status_code: Number.isFinite(Number(z.status_code)) ? Number(z.status_code) : null,
            ok: Number(z.status_code) > 0 && Number(z.status_code) < 400,
            duration_ms: Number.isFinite(Number(z.duration_ms)) ? Math.round(Number(z.duration_ms)) : null,
            ip_address: rez(z.ip_address, 255),
            user_agent: rez(z.user_agent, 500),
            api_user_uuid: z.api_user_uuid || partner?.uuid || null,
            partner_uuid: z.partner_uuid || partner?.partner_uuid || null,
            partner_acr: z.partner_acr || partner?.partner_acr || null,
            partner_name: partner?.partner_name || null,
            tid: rez(z.tid || partner?.tid, 255),
            error_msg: rez(z.error_msg, 1000),
            order_number: rez(z.order_number, 255),
        });
        ocisti(PartnerApiLogsModel).catch(() => {});
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.log("createPartnerApiLogController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

// GET — popis s filtrima: from, to, partner_uuid, tid, samo=greske, status, path.
const getPartnerApiLogsController = async (req, res) => {
    try {
        const { PartnerApiLogsModel } = req.app.locals.models;
        const q = req.query || {};
        const where = {};
        const od = q.from ? new Date(q.from) : null;
        const doo = q.to ? new Date(q.to) : null;
        if (doo && !isNaN(doo)) doo.setHours(23, 59, 59, 999);
        if (od && !isNaN(od) && doo && !isNaN(doo)) where.createdAt = { [Op.between]: [od, doo] };
        else if (od && !isNaN(od)) where.createdAt = { [Op.gte]: od };
        else if (doo && !isNaN(doo)) where.createdAt = { [Op.lte]: doo };
        if (q.partner_uuid) where.partner_uuid = q.partner_uuid;
        if (q.tid) where.tid = q.tid;
        if (q.samo === "greske") where.ok = false;
        if (q.status) where.status_code = Number(q.status);
        if (q.path) where.path = { [Op.iLike]: `%${q.path}%` };

        const limit = Math.min(Number(q.limit) || 1000, 2000);
        const { rows, count } = await PartnerApiLogsModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
        });
        return res.status(200).json({ logs: rows.map((r) => r.toJSON()), total: count });
    } catch (error) {
        console.log("getPartnerApiLogsController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

module.exports = { createPartnerApiLogController, getPartnerApiLogsController };
