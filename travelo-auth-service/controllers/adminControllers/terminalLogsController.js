// Log komunikacije naplatnih uređaja (desk i mobilna) — upis (zove gateway,
// fire-and-forget) i čitanje (zove web_portal-service, pristup samo za admina).

const { Op } = require("sequelize");

// Uređaji se javljaju puno češće od partnera, pa se zapisi drže mjesec dana.
// Čišćenje ide najviše jednom na sat, uz upis — bez zasebnog rasporeda.
const ZADRZI_MJESECI = 1;
const CISCENJE_MS = 60 * 60 * 1000;
let zadnjeCiscenje = 0;

const ocisti = async (TerminalLogsModel) => {
    if (Date.now() - zadnjeCiscenje < CISCENJE_MS) return;
    zadnjeCiscenje = Date.now();
    const granica = new Date();
    granica.setMonth(granica.getMonth() - ZADRZI_MJESECI);
    await TerminalLogsModel.destroy({ where: { createdAt: { [Op.lt]: granica } } });
};

// TID nije u tokenu (samo uuid uređaja) — čita se iz šifarnika terminala, a
// vrsta klijenta iz zadnjeg javljanja uređaja. Oboje se rijetko mijenja, pa se
// drži u memoriji 10 minuta.
let uredjaji = null;
let uredjajiU = 0;
const ucitajUredjaje = async ({ TerminalsModel, DeviceConnectionsModel }) => {
    if (uredjaji && Date.now() - uredjajiU < 10 * 60 * 1000) return uredjaji;
    const [terminali, javljanja] = await Promise.all([
        TerminalsModel.findAll({ attributes: ["uuid", "tid"], raw: true }),
        DeviceConnectionsModel.findAll({ attributes: ["tid", "client"], raw: true }),
    ]);
    uredjaji = {
        tidPoUuid: new Map(terminali.map((t) => [t.uuid, t.tid])),
        klijentPoTid: new Map(javljanja.map((j) => [String(j.tid), j.client])),
    };
    uredjajiU = Date.now();
    return uredjaji;
};

// Kad uređaj nije javio verziju, klijent se pogađa po HTTP biblioteci: desk
// šalje kroz axios (Node), mobilna kroz okhttp (Android).
const klijentIzAgenta = (ua) => {
    const s = String(ua || "").toLowerCase();
    if (s.includes("okhttp")) return "mobile";
    if (s.includes("axios") || s.includes("electron")) return "desk";
    return null;
};

const rez = (v, n) => (v == null ? null : String(v).slice(0, n));

// POST — jedan zapis po zahtjevu uređaja.
const createTerminalLogController = async (req, res) => {
    try {
        const { TerminalLogsModel } = req.app.locals.models;
        const z = req.body?.body || req.body || {};
        const u = await ucitajUredjaje(req.app.locals.models).catch(() => null);
        const tid = z.tid || (z.terminal_uuid && u?.tidPoUuid.get(z.terminal_uuid)) || null;
        const status = Number(z.status_code);
        await TerminalLogsModel.create({
            method: rez(z.method, 10),
            path: rez(z.path, 255),
            status_code: Number.isFinite(status) && status > 0 ? status : null,
            ok: status > 0 && status < 400,
            duration_ms: Number.isFinite(Number(z.duration_ms)) ? Math.round(Number(z.duration_ms)) : null,
            ip_address: rez(z.ip_address, 255),
            user_agent: rez(z.user_agent, 500),
            terminal_uuid: rez(z.terminal_uuid, 255),
            tid: rez(tid, 255),
            client: rez(z.client || (tid && u?.klijentPoTid.get(String(tid))) || klijentIzAgenta(z.user_agent), 20),
            error_msg: rez(z.error_msg, 1000),
            response_summary: rez(z.response_summary, 1000),
            request_body: rez(z.request_body, 20000),
            response_body: rez(z.response_body, 20000),
        });
        ocisti(TerminalLogsModel).catch(() => {});
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.log("createTerminalLogController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

// GET — popis s filtrima: from, to, tid, client, samo=greske, path.
const getTerminalLogsController = async (req, res) => {
    try {
        const { TerminalLogsModel } = req.app.locals.models;
        const q = req.query || {};
        const where = {};
        const od = q.from ? new Date(q.from) : null;
        const doo = q.to ? new Date(q.to) : null;
        if (doo && !isNaN(doo)) doo.setHours(23, 59, 59, 999);
        if (od && !isNaN(od) && doo && !isNaN(doo)) where.createdAt = { [Op.between]: [od, doo] };
        else if (od && !isNaN(od)) where.createdAt = { [Op.gte]: od };
        else if (doo && !isNaN(doo)) where.createdAt = { [Op.lte]: doo };
        if (q.tid) where.tid = q.tid;
        if (q.client) where.client = q.client;
        if (q.samo === "greske") where.ok = false;
        if (q.path) where.path = { [Op.iLike]: `%${q.path}%` };

        const limit = Math.min(Number(q.limit) || 1000, 2000);
        // Sadržaj zahtjeva i odgovora ne ide u popis — dohvaća se po zapisu,
        // kad se otvori detalj.
        const { rows, count } = await TerminalLogsModel.findAndCountAll({
            where,
            attributes: { exclude: ["request_body", "response_body"] },
            order: [["createdAt", "DESC"]],
            limit,
        });
        return res.status(200).json({ logs: rows.map((r) => r.toJSON()), total: count });
    } catch (error) {
        console.log("getTerminalLogsController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

// GET /:id — jedan zapis sa sadržajem zahtjeva i odgovora.
const getTerminalLogController = async (req, res) => {
    try {
        const { TerminalLogsModel } = req.app.locals.models;
        const zapis = await TerminalLogsModel.findByPk(Number(req.params.id));
        if (!zapis) return res.status(404).json({ message: "Zapis ne postoji." });
        return res.status(200).json({ log: zapis.toJSON() });
    } catch (error) {
        console.log("getTerminalLogController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

module.exports = { createTerminalLogController, getTerminalLogsController, getTerminalLogController };
