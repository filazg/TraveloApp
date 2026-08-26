const { Op } = require("sequelize");
const { getSequelize } = require("../../config/database");
const sequelize = getSequelize();

// Statusi karte u kojima je promjena polaska dopuštena.
// "created" i "issued" su ista stvar pod dva imena — POS i web ih pišu različito.
// "trip_canceled" je karta otkazanog putovanja: putniku se nudi drugi polazak
// umjesto povrata novca, pa se i ona smije prebaciti.
const STATUSI_ZA_PROMJENU = ["created", "issued", "CREATED", "ISSUED", "trip_canceled", "TRIP_CANCELED"];

const jeOtkazanoPutovanje = (t) => String(t?.status || "").toLowerCase() === "trip_canceled";

const jePrebaciva = (t) => {
    if (!t) return { ok: false, razlog: "karta ne postoji" };
    // Karta otkazanog putovanja nosi `is_canceled`, ali nije stornirana — nju
    // se smije prebaciti; provjeru statusa niže obavlja popis dopuštenih.
    if (t.is_canceled && !jeOtkazanoPutovanje(t)) return { ok: false, razlog: "karta je stornirana" };
    // Partnerske karte se ne prebacuju. One se ne naplaćuju po prodaji nego
    // zbirnim računom partneru, pa promjena ovdje ne bi imala gdje proizvesti
    // razliku — rješava se kroz partnerski obračun.
    if (t.partner_uuid) return { ok: false, razlog: "partnerska karta — promjena ide preko partnera" };
    if (t.transferred_to_ticket_uuid) return { ok: false, razlog: "karta je već prebačena na drugi polazak" };
    const status = String(t.status || "").trim();
    if (status && !STATUSI_ZA_PROMJENU.includes(status)) {
        return { ok: false, razlog: `karta je u statusu ${status}` };
    }
    return { ok: true };
};

// POST /transfer_tickets
// body: {
//   pairs: [{ from_ticket_uuid, to_ticket_uuid }],   // stara -> nova karta
//   percentage,                                      // priznati postotak izvorne cijene
//   invoice_uuid                                     // racun razlike, za trag
// }
//
// Novi racun i nove karte klijent vec posalje kroz /finalize_terminal_sale —
// blagajne su autoritet za numeraciju i moraju raditi offline, pa backend to
// samo pasivno sprema. Ovdje se zatvara druga strana promjene: stara karta
// prestaje vrijediti i vezuje se na novu.
//
// Idempotentno je: ponovni poziv za istu kartu ne mijenja nista i ne javlja
// gresku, jer klijent ovo zove nakon sto je racun vec izdan i mora smjeti
// ponoviti ako je veza pukla.
const transferTicketsController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const data = (req.body && typeof req.body.body === "object" && req.body.body !== null)
            ? req.body.body
            : (req.body || {});
        const pairs = Array.isArray(data.pairs) ? data.pairs : [];
        const percentage = Number(data.percentage);

        if (!pairs.length) {
            return res.status(400).json({ status: 400, data: { message: "pairs required" } });
        }
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
            return res.status(400).json({ status: 400, data: { message: "percentage mora biti 0-100" } });
        }

        const stareUuids = pairs.map((p) => p.from_ticket_uuid).filter(Boolean);
        const stare = await TicketsModel.findAll({ where: { ticket_uuid: { [Op.in]: stareUuids } } });
        const poUuidu = new Map(stare.map((t) => [t.ticket_uuid, t]));

        // Nova karta mora stvarno postojati. Bez ove provjere stara bi se
        // zatvorila i pokazivala na ništa, a putnik bi ostao bez obje.
        const noveUuids = pairs.map((p) => p.to_ticket_uuid).filter(Boolean);
        const nove = await TicketsModel.findAll({
            where: { ticket_uuid: { [Op.in]: noveUuids } },
            attributes: ["ticket_uuid"],
        });
        const postojece = new Set(nove.map((t) => t.ticket_uuid));

        // Prvo provjeri sve, pa tek onda mijenjaj — da djelomican prijenos ne
        // ostavi dio karata prebacen a dio ne.
        const problemi = [];
        for (const par of pairs) {
            const stara = poUuidu.get(par.from_ticket_uuid);
            if (stara?.transferred_to_ticket_uuid === par.to_ticket_uuid) continue; // vec obavljeno
            if (!par.to_ticket_uuid || !postojece.has(par.to_ticket_uuid)) {
                problemi.push({ ticket_uuid: par.from_ticket_uuid, razlog: "nova karta ne postoji" });
                continue;
            }
            const provjera = jePrebaciva(stara);
            if (!provjera.ok) problemi.push({ ticket_uuid: par.from_ticket_uuid, razlog: provjera.razlog });
        }
        if (problemi.length) {
            return res.status(409).json({ status: 409, data: { message: "promjena nije moguca", problemi } });
        }

        let prebaceno = 0;
        await sequelize.transaction(async (t) => {
            for (const par of pairs) {
                const stara = poUuidu.get(par.from_ticket_uuid);
                if (stara.transferred_to_ticket_uuid === par.to_ticket_uuid) continue;

                const priznato = +(Number(stara.single_price || 0) * percentage / 100).toFixed(2);
                await stara.update({
                    is_active: false,
                    is_canceled: true,
                    status: "transferred",
                    transferred_to_ticket_uuid: par.to_ticket_uuid,
                    transfer_percentage: percentage,
                    transfer_credit: priznato,
                }, { transaction: t });

                // Nova karta pokazuje natrag, da se s nje vidi odakle je dosla.
                await TicketsModel.update(
                    { transferred_from_ticket_uuid: par.from_ticket_uuid },
                    { where: { ticket_uuid: par.to_ticket_uuid }, transaction: t }
                );
                prebaceno++;
            }
        });

        res.status(200).json({
            status: 200,
            data: {
                transferred: prebaceno,
                already_done: pairs.length - prebaceno,
                percentage,
                invoice_uuid: data.invoice_uuid || null,
            },
        });
    } catch (error) {
        console.log("transferTicketsController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { transferTicketsController };
