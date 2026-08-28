const { Op } = require("sequelize");

// departure_planed je slobodan tekst i ovisi o tome tko je zapisao redak:
//   "YYYY-MM-DD HH:mm"    — noviji zapisi
//   "DD/MM/YYYY HH:mm"    — stariji zapisi
//   "DD.MM.YYYY. HH:mm"   — POS (desktop/mobile) i boat servis; dan i mjesec
//                           znaju biti bez vodeće nule ("1.9.2026.")
// Za zadani ISO datum vraća sve prefikse da LIKE pogodi bilo koji od formata.
const datePrefixes = (isoDate) => {
    const out = [];
    if (!isoDate) return out;
    const iso = String(isoDate).trim();
    out.push(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (m) {
        const [, y, mm, dd] = m;
        out.push(`${dd}/${mm}/${y}`);
        const d1 = String(parseInt(dd, 10));
        const m1 = String(parseInt(mm, 10));
        for (const d of new Set([dd, d1])) {
            for (const mo of new Set([mm, m1])) {
                out.push(`${d}.${mo}.${y}.`);
            }
        }
    }
    return [...new Set(out)];
};

// Status karte pišu tri servisa i dva klijenta, svaki svojim zapisom:
//   POS/boat-desk → ISSUED | VALIDATE | CANCELED
//   validateTicketController → validated
//   cancelTicketsController → canceled
//   dispatcherController (otkaz polaska) → trip_canceled
//   partnerski računi → issued
// Filtar zato ne smije biti egzaktna usporedba — za traženi status vrati sve
// zapise koji mu odgovaraju.
const STATUS_SYNONYMS = {
    issued: ["ISSUED", "issued", "CREATED", "created"],
    validated: ["VALIDATED", "validated", "VALIDATE", "validate"],
    canceled: ["CANCELED", "canceled", "CANCELLED", "cancelled"],
    trip_canceled: ["trip_canceled", "TRIP_CANCELED"],
};
const statusValues = (status) => {
    const key = String(status || "").trim().toLowerCase();
    return STATUS_SYNONYMS[key] || [status];
};

const listTicketsController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const {
            date,
            date_from,
            line_code,
            departure_harbor_id,
            arrival_harbor_id,
            status,
            ticket_code,
            ticket_uuid,
            order_uuid,
            partner_uuid,
            route_uuids, // CSV — koristi mobile validacija za sve karte odabranog polaska
            // Filtri koji se čitaju s računa, ne s karte:
            business_premise_uuids, // CSV — kanal prodaje (blagajna, mobilna, ured, web)
            billing_device_uuid,    // konkretan naplatni uređaj
            payment_method_uuid,
            // Partnerske karte nemaju račun u trenutku prodaje — naplaćuju se
            // zbirno partneru — pa se kao kanal prepoznaju po partneru, a ne
            // preko računa.
            partner_only,
            limit,
            offset,
        } = req.query || {};

        const where = {};

        // Pretraga po jednoj karti ne traži datum. QR kod nosi ticket_uuid, pa
        // mobilna validacija tim putem prepoznaje kartu koju uređaj nema u
        // lokalnoj kopiji — karta s druge linije ili drugog dana.
        if (ticket_uuid) {
            where.ticket_uuid = ticket_uuid;
        } else if (ticket_code) {
            where.ticket_code = ticket_code;
        } else if (order_uuid) {
            where.order_uuid = order_uuid;
        } else {
            const dIso = date_from || date;
            if (!dIso) {
                return res.status(400).json({
                    status: 400,
                    data: { message: "date required unless ticket_code/order_uuid provided" },
                });
            }
            const prefixes = datePrefixes(dIso);
            where[Op.or] = prefixes.map((p) => ({
                departure_planed: { [Op.like]: `${p}%` },
            }));
            if (route_uuids) {
                const list = String(route_uuids)
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (list.length) where.route_uuid = { [Op.in]: list };
            }
            if (line_code) where.line_code = line_code;
            if (departure_harbor_id) where.departure_harbor_id = departure_harbor_id;
            if (arrival_harbor_id) where.arrival_harbor_id = arrival_harbor_id;
            if (status && status !== "ALL") where.status = { [Op.in]: statusValues(status) };
            if (partner_uuid) where.partner_uuid = partner_uuid;
            else if (partner_only === "1" || partner_only === "true") {
                where.partner_uuid = { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] };
            }
        }

        // Kanal prodaje i sredstvo plaćanja stoje na RAČUNU, ne na karti. Zato
        // se filtriranje po njima radi u dva koraka: prvo se nađu računi koji
        // odgovaraju, pa se karte ograniče na njih. Filtar u pamćenju ne bi
        // valjao jer bi se primijenio tek nakon `limit`-a.
        const { InvoiceModel } = req.app.locals.models;
        const racunFiltar = {};
        if (business_premise_uuids) {
            const list = String(business_premise_uuids).split(",").map((x) => x.trim()).filter(Boolean);
            if (list.length) racunFiltar.invoice_business_premise_uuid = { [Op.in]: list };
        }
        if (billing_device_uuid) racunFiltar.invoice_billing_device_uuid = billing_device_uuid;
        if (payment_method_uuid) racunFiltar.invoice_payment_method_uuid = payment_method_uuid;

        if (Object.keys(racunFiltar).length) {
            const racuni = await InvoiceModel.findAll({
                where: racunFiltar,
                attributes: ["invoice_uuid", "order_uuid"],
            });
            const uuids = racuni.map((r) => r.invoice_uuid);
            // Karte web prodaje nemaju `invoice_uuid`, ali imaju `order_uuid`
            // koji stoji i na računu — pa se hvataju i tim putem, inače bi
            // filtar po kanalu "Web" uvijek vratio prazno.
            const narudzbe = racuni
                .flatMap((r) => String(r.order_uuid || "").split(","))
                .map((x) => x.trim())
                .filter(Boolean);
            // Ide kroz Op.and jer Op.or na `where` već drži filtar po datumu —
            // izravno pridruživanje bi ga preklopilo i vratilo karte svih dana.
            where[Op.and] = [
                ...(where[Op.and] || []),
                {
                    [Op.or]: [
                        { invoice_uuid: { [Op.in]: uuids.length ? uuids : ["-"] } },
                        ...(narudzbe.length ? [{ order_uuid: { [Op.in]: narudzbe } }] : []),
                    ],
                },
            ];
        }

        const lim = Math.min(parseInt(limit, 10) || 1000, 5000);
        const off = parseInt(offset, 10) || 0;

        const { rows, count } = await TicketsModel.findAndCountAll({
            where,
            order: [["departure_planed", "ASC"], ["id", "ASC"]],
            limit: lim,
            offset: off,
        });

        // Uz svaku kartu ide i podatak s njezina računa, da pregled može
        // prikazati kanal, uređaj i sredstvo plaćanja bez dodatnog dohvata.
        const invUuids = [...new Set(rows.map((t) => t.invoice_uuid).filter(Boolean))];
        const racuni = invUuids.length
            ? await InvoiceModel.findAll({
                where: { invoice_uuid: { [Op.in]: invUuids } },
                attributes: [
                    "invoice_uuid", "invoice_no", "invoice_year", "invoice_date",
                    "invoice_business_premise_uuid", "invoice_business_premise_name",
                    "invoice_billing_device_uuid", "invoice_billing_device_fiscal_mark",
                    "invoice_payment_method_uuid", "invoice_payment_method_name",
                ],
            })
            : [];
        const poRacunu = new Map(racuni.map((r) => [r.invoice_uuid, r]));

        // Web prodaja karti ne upisuje uvijek `invoice_uuid` — račun tada nosi
        // `order_uuid` (za više narudžbi odjednom, odvojene zarezom). Bez ovog
        // drugog puta karta ostaje bez kanala prodaje, uređaja i sredstva
        // plaćanja iako račun postoji.
        const bezVeze = rows.filter((t) => !t.invoice_uuid && t.order_uuid);
        const poNarudzbi = new Map();
        if (bezVeze.length) {
            const narudzbe = [...new Set(bezVeze.map((t) => t.order_uuid))];
            const racuniNarudzbi = await InvoiceModel.findAll({
                where: { [Op.or]: narudzbe.map((u) => ({ order_uuid: { [Op.like]: `%${u}%` } })) },
                attributes: [
                    "invoice_uuid", "invoice_no", "invoice_year", "invoice_date", "order_uuid",
                    "invoice_business_premise_uuid", "invoice_business_premise_name",
                    "invoice_billing_device_uuid", "invoice_billing_device_fiscal_mark",
                    "invoice_payment_method_uuid", "invoice_payment_method_name",
                ],
            });
            for (const r of racuniNarudzbi) {
                for (const u of String(r.order_uuid || "").split(",")) {
                    const kljuc = u.trim();
                    if (kljuc && !poNarudzbi.has(kljuc)) poNarudzbi.set(kljuc, r);
                }
            }
        }

        const tickets = rows.map((t) => {
            const r = poRacunu.get(t.invoice_uuid) || poNarudzbi.get(t.order_uuid);
            return {
                ...t.toJSON(),
                invoice_no: r ? `${r.invoice_no}/${r.invoice_year}` : null,
                // Vrijeme izdavanja: s računa ako ga karta ima, inače trenutak
                // kad je karta nastala — partnerske karte nemaju račun u
                // trenutku prodaje, pa bi im stupac inače uvijek bio prazan.
                issued_at: r?.invoice_date || t.createdAt || null,
                business_premise_uuid: r?.invoice_business_premise_uuid || null,
                business_premise_name: r?.invoice_business_premise_name || null,
                billing_device_uuid: r?.invoice_billing_device_uuid || null,
                billing_device_mark: r?.invoice_billing_device_fiscal_mark || null,
                payment_method_uuid: r?.invoice_payment_method_uuid || null,
                payment_method_name: r?.invoice_payment_method_name || null,
            };
        });

        res.status(200).json({
            status: 200,
            data: { tickets, total: count, limit: lim, offset: off },
        });
    } catch (error) {
        console.log("listTicketsController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listTicketsController };
