const crypto = require("crypto");
const { Op } = require("sequelize");
const { getModels } = require("../dbModels");
const { poljaUredaja } = require("./naplatniUredaj");

// Evidencija storna po karti (tablica ticket_stornos) i provjera validacije
// prije storna. Isti rok kao na uređajima (desk invoiceDataService.ocijeniRok,
// mobile services/stornoRok.js): storno je u roku do 30 min nakon polaska.
const ROK_NAKON_POLASKA_MIN = 30;

// Polazak stiže u više oblika: "28.08.2026. 10:00", "28.08.2026.10:00" ili ISO.
const parsirajPolazak = (vrijednost) => {
    const s = String(vrijednost || "").trim();
    if (!s) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5]);
    const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?\s*(\d{1,2}):(\d{2})/.exec(s);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1], +dmy[4], +dmy[5]);
    return null;
};

const razvrstaj = (polazakText, stornoAt) => {
    const polazak = parsirajPolazak(polazakText);
    if (!polazak || !stornoAt || isNaN(stornoAt)) return { kategorija: "nepoznato", minutes_after_departure: null };
    const minute = Math.floor((stornoAt.getTime() - polazak.getTime()) / 60000);
    if (minute <= 0) return { kategorija: "prije_polaska", minutes_after_departure: minute };
    if (minute <= ROK_NAKON_POLASKA_MIN) return { kategorija: "u_roku", minutes_after_departure: minute };
    return { kategorija: "nakon_roka", minutes_after_departure: minute };
};

// Prva validacija očitanjem po karti. Automatska validacija pri prodaji se ne
// broji: ona ne upisuje ticket_validations, a nije ni ukrcaj koji bi storno
// trebao spriječiti — karta prodana greškom na brodu mora se moći vratiti.
const validacijeKarata = async (ticketUuids) => {
    const uuids = [...new Set((ticketUuids || []).filter(Boolean))];
    if (!uuids.length) return {};
    const { TicketValidationModel } = getModels();
    const redovi = await TicketValidationModel.findAll({
        where: { ticket_uuid: { [Op.in]: uuids }, outcome: "validated" },
        attributes: ["ticket_uuid", "validated_at"],
        order: [["validated_at", "ASC"]],
        raw: true,
    });
    const prva = {};
    for (const r of redovi) if (!prva[r.ticket_uuid]) prva[r.ticket_uuid] = r.validated_at;
    return prva;
};

const datum = (v) => {
    const d = v ? new Date(v) : new Date();
    return isNaN(d) ? new Date() : d;
};

// Upis za svaku kartu. `karte` su redci iz tablice tickets (ili isti oblik);
// `ctx.polasci` je { ticket_uuid: polazak } kako ga je uređaj koristio za rok.
// Best-effort: neuspjeh upisa ne ruši storno koji je već izdan.
async function zabiljeziStorna(karte, ctx = {}) {
    try {
        if (!karte?.length) return;
        const { TicketStornoModel } = getModels();
        const stornoAt = datum(ctx.storno_at);
        const validacije = await validacijeKarata(karte.map((k) => k.ticket_uuid));
        const uredaj = await poljaUredaja(ctx.terminal_uuid, "terminal");
        const pct = ctx.percentage != null ? Number(ctx.percentage) : null;
        const polasci = ctx.polasci || {};

        const redovi = karte.map((k) => {
            const polazak = polasci[k.ticket_uuid] || k.departure || k.departure_planed || null;
            const cijena = Number(k.single_price ?? k.ticket_single_price ?? 0) || 0;
            return {
                uuid: crypto.randomUUID(),
                outcome: ctx.outcome || "storno",
                source: ctx.source || null,
                ticket_uuid: k.ticket_uuid || null,
                ticket_code: k.ticket_code || null,
                ticket_type_name: k.ticket_type_name || null,
                ticket_price: cijena,
                invoice_uuid: k.invoice_uuid || null,
                storno_invoice_uuid: ctx.storno_invoice_uuid || null,
                storno_invoice_code: ctx.storno_invoice_code || null,
                percentage: pct,
                refund_amount: pct != null && ctx.outcome !== "odbijeno_validirana" ? +(cijena * pct / 100).toFixed(2) : null,
                line_code: k.line_code || null,
                line_name: k.line_name || null,
                departure_harbor_name: k.departure_harbor_name || null,
                arrival_harbor_name: k.arrival_harbor_name || null,
                route_uuid: k.route_uuid || null,
                departure_planed: k.departure_planed || null,
                polazak,
                storno_at: stornoAt,
                ...razvrstaj(polazak, stornoAt),
                validated_at: validacije[k.ticket_uuid] || null,
                slobodno_storniranje: ctx.slobodno_storniranje == null ? null : Boolean(ctx.slobodno_storniranje),
                ...uredaj,
                operator: ctx.operator || null,
            };
        });
        await TicketStornoModel.bulkCreate(redovi);
    } catch (e) {
        console.log("[storno-evidencija] zapis nije uspio:", e?.message || e);
    }
}

module.exports = { zabiljeziStorna, validacijeKarata, razvrstaj, ROK_NAKON_POLASKA_MIN };
