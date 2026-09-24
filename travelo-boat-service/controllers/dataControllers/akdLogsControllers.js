const { Op } = require("sequelize");

// Zapis poziva prema AKD-u. Upisuje ih akd servis, čita ih portal
// (Sistem → AKD log).
//
// Upis je namjerno neotporan na grešku u podacima: zapis koji se ne da spremiti
// se preskače i vraća se 200. Poziv prema AKD-u je već napravljen i njegov
// ishod ne smije ovisiti o tome je li log prošao.

// Duži odgovor se ne sprema u cijelosti: SOAP odgovor zna biti desetak
// kilobajta, a za dijagnozu je dovoljan početak. Granica je ovdje, na jednom
// mjestu, da je ne mora poštovati svaki pozivatelj.
const NAJVISE_ZNAKOVA = 8000;

const skrati = (v) => {
    if (v === null || v === undefined) return null;
    const t = typeof v === "string" ? v : JSON.stringify(v);
    return t.length > NAJVISE_ZNAKOVA ? `${t.slice(0, NAJVISE_ZNAKOVA)}\n… skraćeno (${t.length} znakova)` : t;
};

const createAkdLogController = async (req, res) => {
    const { AkdLogModel } = req.app.locals.models;
    try {
        const d = req.body?.body || req.body || {};
        await AkdLogModel.create({
            sustav: String(d.sustav || "SEOP").toUpperCase(),
            metoda: d.metoda || null,
            terminal_uuid: d.terminal_uuid || null,
            terminal_tid: d.terminal_tid || null,
            terminal_naziv: d.terminal_naziv || null,
            izvor: d.izvor || (d.terminal_uuid ? "terminal" : "servis"),
            iskaznica: d.iskaznica ? String(d.iskaznica).trim() : null,
            id_vrsta: d.id_vrsta || null,
            line_no: d.line_no ? String(d.line_no) : null,
            relacija: d.relacija || null,
            ok: d.ok !== false,
            http_status: Number.isFinite(Number(d.http_status)) ? Number(d.http_status) : null,
            greska_kod: d.greska_kod ? String(d.greska_kod) : null,
            greska_opis: d.greska_opis ? String(d.greska_opis) : null,
            trajanje_ms: Number.isFinite(Number(d.trajanje_ms)) ? Number(d.trajanje_ms) : null,
            okolina: d.okolina || null,
            zahtjev: skrati(d.zahtjev),
            odgovor: skrati(d.odgovor),
        });
        res.send({ status: 200, data: { ok: true } });
    } catch (error) {
        console.log("createAkdLogController error:", error?.message || error);
        // Namjerno 200: pozivatelj je akd servis usred razgovora s AKD-om.
        res.send({ status: 200, data: { ok: false, message: error.message } });
    }
};

const listAkdLogsController = async (req, res) => {
    const { AkdLogModel } = req.app.locals.models;
    try {
        const where = {};

        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        // "Do" je uključiv — obuhvati cijeli dan, kao i u pregledima Kontrole.
        if (to && !isNaN(to)) to.setHours(23, 59, 59, 999);
        if (from && !isNaN(from) && to && !isNaN(to)) where.createdAt = { [Op.between]: [from, to] };
        else if (from && !isNaN(from)) where.createdAt = { [Op.gte]: from };
        else if (to && !isNaN(to)) where.createdAt = { [Op.lte]: to };

        if (req.query.terminal_uuid) where.terminal_uuid = String(req.query.terminal_uuid).trim();
        if (req.query.sustav) where.sustav = String(req.query.sustav).trim().toUpperCase();
        if (req.query.metoda) where.metoda = String(req.query.metoda).trim();
        // Traži se po broju kako je upisan, ali i po dijelu broja — putnik zna
        // reći zadnje znamenke, a blagajnik cijeli broj.
        if (req.query.iskaznica) {
            where.iskaznica = { [Op.iLike]: `%${String(req.query.iskaznica).trim()}%` };
        }
        // "greske" pokazuje samo ono što nije prošlo — u redovnom radu je to
        // nekoliko zapisa među tisućama.
        if (req.query.samo === "greske") where.ok = false;
        // "poruke" hvata i poslovne odbijenice: „Iskaznica nije pronađena
        // (MXRF1)" stigne kao uredan odgovor, pa po `ok` ne bi ispala. Upravo se
        // takvi slučajevi traže kad putnik pita zašto mu pravo nije priznato.
        if (req.query.samo === "poruke") where.greska_opis = { [Op.ne]: null };

        const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 500));

        const { rows, count } = await AkdLogModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            raw: true,
        });

        res.send({ status: 200, data: { logs: rows, ukupno: count, prikazano: rows.length } });
    } catch (error) {
        console.log("listAkdLogsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { createAkdLogController, listAkdLogsController };
