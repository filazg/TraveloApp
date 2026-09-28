const { Op } = require("sequelize");
const { getModels } = require("../../dbModels");
const { zabiljeziStorna, validacijeKarata } = require("../../helpers/stornoEvidencija");

// Provjera prije storna: je li koja od karata validirana očitanjem. Uređaj je
// zove prije odabira postotka i prije povrata na karticu. Validirana karta se
// ne stornira — vožnja je pružena — a pokušaj se bilježi u Kontrolu.
//
// Karta koje na poslužitelju još nema (prodaja nije stigla) nema ni validacije,
// pa storno prolazi; isto i kad poslužitelj ne odgovori — uređaj tada odlučuje
// sam, kao i dosad.
const stornoCheckController = async (req, res) => {
    try {
        const { TicketsModel } = getModels();
        const body = req.body?.body || req.body || {};
        const uuids = Array.isArray(body.ticket_uuids) ? body.ticket_uuids.filter(Boolean) : [];
        if (!uuids.length) {
            return res.status(400).send({ status: 400, data: { message: "ticket_uuids required" } });
        }

        const validacije = await validacijeKarata(uuids);
        const validirane = Object.keys(validacije);
        if (!validirane.length) {
            return res.send({ status: 200, data: { allowed: true, validated: [] } });
        }

        // Dvostruko zapisana karta ima više redaka — dovoljan je jedan.
        const redovi = await TicketsModel.findAll({ where: { ticket_uuid: { [Op.in]: validirane } }, raw: true });
        const karte = [];
        const vidjene = new Set();
        for (const r of redovi) {
            if (vidjene.has(r.ticket_uuid)) continue;
            vidjene.add(r.ticket_uuid);
            karte.push(r);
        }

        await zabiljeziStorna(karte, {
            outcome: "odbijeno_validirana",
            source: body.source || null,
            terminal_uuid: body.terminal_uuid || null,
            operator: body.operator || null,
            storno_at: body.attempted_at || null,
            polasci: body.polasci || {},
            percentage: body.percentage ?? null,
            slobodno_storniranje: body.slobodno_storniranje,
        });

        const validated = karte.map((k) => ({
            ticket_uuid: k.ticket_uuid,
            ticket_code: k.ticket_code,
            validated_at: validacije[k.ticket_uuid],
        }));
        const kodovi = validated.map((v) => v.ticket_code).filter(Boolean).join(", ");
        res.send({
            status: 200,
            data: {
                allowed: false,
                validated,
                message: validated.length === 1
                    ? `Karta ${kodovi} je validirana na ukrcaju — storno nije moguć.`
                    : `Karte ${kodovi} su validirane na ukrcaju — storno nije moguć.`,
            },
        });
    } catch (error) {
        console.log("stornoCheckController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Pokušaj storna izvan roka (30 min nakon polaska). Rok provjerava uređaj sam i
// storno ne dopušta, pa bi bez ovoga pokušaj ostao nevidljiv. Uređaj pokušaje
// bez veze čuva i šalje kasnije, pa svaki nosi svoje vrijeme (attempted_at).
// Karta koje na poslužitelju još nema upisuje se s podacima koje je poslao
// uređaj.
const stornoAttemptController = async (req, res) => {
    try {
        const { TicketsModel } = getModels();
        const body = req.body?.body || req.body || {};
        const pokusaji = Array.isArray(body.attempts) ? body.attempts.filter((a) => a?.ticket_uuid) : [];
        if (!pokusaji.length) {
            return res.status(400).send({ status: 400, data: { message: "attempts required" } });
        }
        const redovi = await TicketsModel.findAll({
            where: { ticket_uuid: { [Op.in]: pokusaji.map((a) => a.ticket_uuid) } },
            raw: true,
        });
        const poUuid = {};
        for (const r of redovi) if (!poUuid[r.ticket_uuid]) poUuid[r.ticket_uuid] = r;

        const karte = pokusaji.map((a) => ({ ...a, ...(poUuid[a.ticket_uuid] || {}), polazak: a.polazak, attempted_at: a.attempted_at }));
        await zabiljeziStorna(karte, {
            outcome: "odbijeno_rok",
            source: body.source || null,
            terminal_uuid: body.terminal_uuid || null,
            operator: body.operator || null,
            slobodno_storniranje: body.slobodno_storniranje,
        });
        res.send({ status: 200, data: { recorded: karte.length } });
    } catch (error) {
        console.log("stornoAttemptController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Kontrola → „Storniranje". Razvrstavanje je upisano uz zapis; „validirane"
// su storna i odbijeni pokušaji karata koje su bile validirane očitanjem.
const KATEGORIJE = ["prije_polaska", "u_roku", "nakon_roka", "nepoznato"];

const jeValidirana = (r) => r.outcome === "odbijeno_validirana" || !!r.validated_at;
// Vremenske kartice broje storna i pokušaje izvan roka; pokušaj storna
// validirane karte ide samo u „Validirane".
const uVremenskoj = (r) => r.outcome === "storno" || r.outcome === "odbijeno_rok";

const listTicketStornosController = async (req, res) => {
    try {
        const { TicketStornoModel } = getModels();
        const where = {};
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        // "Do" je uključiv — cijeli dan, kao i u ostalim pregledima Kontrole.
        if (to && !isNaN(to)) to.setHours(23, 59, 59, 999);
        if (from && !isNaN(from) && to && !isNaN(to)) where.storno_at = { [Op.between]: [from, to] };
        else if (from && !isNaN(from)) where.storno_at = { [Op.gte]: from };
        else if (to && !isNaN(to)) where.storno_at = { [Op.lte]: to };

        const rows = await TicketStornoModel.findAll({
            where,
            order: [["storno_at", "DESC"]],
            limit: 2000,
            raw: true,
        });

        const sve = rows.map((r) => ({ ...r, validirana: jeValidirana(r) }));
        const counts = { sve: sve.length, validirane: sve.filter((r) => r.validirana).length };
        for (const k of KATEGORIJE) counts[k] = sve.filter((r) => r.kategorija === k && uVremenskoj(r)).length;

        const k = req.query.kategorija;
        const stornos = k === "validirane"
            ? sve.filter((r) => r.validirana)
            : KATEGORIJE.includes(k)
                ? sve.filter((r) => r.kategorija === k && uVremenskoj(r))
                : sve;

        res.send({ status: 200, data: { stornos, counts } });
    } catch (error) {
        console.log("listTicketStornosController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { stornoCheckController, stornoAttemptController, listTicketStornosController };
