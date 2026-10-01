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
            request_body: rez(z.request_body, 20000),
            response_body: rez(z.response_body, 20000),
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
        // Sadržaj zahtjeva i odgovora ne ide u popis (do 2000 redaka × 40 KB) —
        // dohvaća se po zapisu, kad se otvori detalj.
        const { rows, count } = await PartnerApiLogsModel.findAndCountAll({
            where,
            attributes: { exclude: ["request_body", "response_body"] },
            order: [["createdAt", "DESC"]],
            limit,
        });
        return res.status(200).json({ logs: rows.map((r) => r.toJSON()), total: count });
    } catch (error) {
        console.log("getPartnerApiLogsController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

// GET /:id — jedan zapis sa sadržajem zahtjeva i odgovora.
const getPartnerApiLogController = async (req, res) => {
    try {
        const { PartnerApiLogsModel } = req.app.locals.models;
        const zapis = await PartnerApiLogsModel.findByPk(Number(req.params.id));
        if (!zapis) return res.status(404).json({ message: "Zapis ne postoji." });
        return res.status(200).json({ log: zapis.toJSON() });
    } catch (error) {
        console.log("getPartnerApiLogController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

// Adrese koje su prešle dopuštene okvire pozivanja API-ja. Granice su iste kao
// u channel-api servisu (middlewares/rateLimiters.js), po minuti:
//   prijava 10 po IP-u · javni pozivi bez prijave 30 po IP-u · ukupno 120.
// Uz odbijenice 429 broji se i vrh zahtjeva u minuti — zahtjevi bez tokena do
// limita partnera nikad ne dođu, pa se skener koji pretražuje bez prijave
// inače ne bi vidio.
const GRANICE = { prijava: 10, anonimno: 30, ukupno: 120 };

const getPartnerApiLimitsController = async (req, res) => {
    try {
        const { PartnerApiLogsModel } = req.app.locals.models;
        const sequelize = PartnerApiLogsModel.sequelize;
        const q = req.query || {};
        const od = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const doo = q.to ? new Date(q.to) : new Date();
        doo.setHours(23, 59, 59, 999);
        const uvjetPreko = `(ukupno > ${GRANICE.ukupno} OR prijave > ${GRANICE.prijava} OR anonimno > ${GRANICE.anonimno} OR odbijeno > 0)`;
        const [adrese] = await sequelize.query(`
            WITH m AS (
                SELECT ip_address,
                       date_trunc('minute', "createdAt") AS minuta,
                       count(*) AS ukupno,
                       count(*) FILTER (WHERE path = '/auth/api_sales_login') AS prijave,
                       count(*) FILTER (WHERE partner_uuid IS NULL AND tid IS NULL) AS anonimno,
                       count(*) FILTER (WHERE status_code = 429) AS odbijeno
                FROM partner_api_logs
                WHERE "createdAt" BETWEEN :od AND :doo AND ip_address IS NOT NULL
                GROUP BY 1, 2
            )
            SELECT ip_address,
                   sum(ukupno)::int AS zahtjeva,
                   max(ukupno)::int AS vrh_u_minuti,
                   max(prijave)::int AS vrh_prijava,
                   max(anonimno)::int AS vrh_anonimno,
                   sum(odbijeno)::int AS odbijeno_429,
                   (count(*) FILTER (WHERE ${uvjetPreko}))::int AS minuta_preko,
                   min(minuta) FILTER (WHERE ${uvjetPreko}) AS prvi_put,
                   max(minuta) FILTER (WHERE ${uvjetPreko}) AS zadnji_put
            FROM m
            GROUP BY ip_address
            HAVING count(*) FILTER (WHERE ${uvjetPreko}) > 0
            ORDER BY zadnji_put DESC
            LIMIT 500`, { replacements: { od, doo } });

        // Tko je s te adrese zvao — partneri (ili SKENER) i klijent.
        if (adrese.length) {
            const [tko] = await sequelize.query(`
                SELECT ip_address,
                       string_agg(DISTINCT COALESCE(partner_name, partner_acr, tid), ', ') AS partneri,
                       bool_or(partner_uuid IS NULL AND tid IS NULL) AS ima_anonimnih,
                       min(user_agent) AS user_agent,
                       string_agg(DISTINCT path, ', ') AS pozivi
                FROM partner_api_logs
                WHERE "createdAt" BETWEEN :od AND :doo AND ip_address IN (:ipovi)
                GROUP BY ip_address`, { replacements: { od, doo, ipovi: adrese.map((a) => a.ip_address) } });
            const poIp = new Map(tko.map((t) => [t.ip_address, t]));
            for (const a of adrese) Object.assign(a, poIp.get(a.ip_address) || {});
        }
        return res.status(200).json({ adrese, granice: GRANICE });
    } catch (error) {
        console.log("getPartnerApiLimitsController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

module.exports = { createPartnerApiLogController, getPartnerApiLogsController, getPartnerApiLogController, getPartnerApiLimitsController };
