const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");

// Obračun provizije partnerima koji rade u naše ime.
//
// Takav partner nije preprodavač: prodaje na našoj blagajni ili mobilnoj, pod
// našim fiskalnim brojem, a prodajno mjesto je u administraciji označeno kao
// partnersko i vezano na partnera. Novac je naš, a partneru dugujemo proviziju —
// suprotan smjer od partnerskih računa, gdje partner duguje nama.
//
// Osnovica je neto: bez lučke pristojbe (prolazna stavka) i bez PDV-a.
const HARBOR_RATE = 0.06;
const VAT_RATE = 0.25;
const neto = (iznos) => {
    const bruto = Number(iznos) || 0;
    const pristojba = +(bruto * HARBOR_RATE).toFixed(2);
    const bezPristojbe = bruto - pristojba;
    const osnovica = +(bezPristojbe / (1 + VAT_RATE)).toFixed(2);
    return { bruto, pristojba, osnovica, pdv: +(bezPristojbe - osnovica).toFixed(2) };
};

const dohvatiIzBackofficea = async (putanja) => {
    const coreConfig = await getCoreServiceConfigData();
    const boUrl = coreConfig?.services?.backoffice?.url;
    if (!boUrl) throw new Error("backoffice service URL missing from core config");
    const resp = await axios.get(`${boUrl}${putanja}`, { timeout: 15000 });
    return resp.data?.data || {};
};

// Datum se prima kao YYYY-MM-DD ili DD/MM/YYYY; granice dana su lokalne.
const pocetakDana = (v) => {
    const s = String(v || "").trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], 0, 0, 0, 0);
    const dmy = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(s);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1], 0, 0, 0, 0);
    return null;
};
const krajDana = (v) => {
    const d = pocetakDana(v);
    if (!d) return null;
    d.setHours(23, 59, 59, 999);
    return d;
};

const partnerCommissionController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const { from, to, partner_uuid } = req.query || {};
        const od = pocetakDana(from);
        const doo = krajDana(to);
        if (!od || !doo) {
            return res.status(400).json({
                status: 400,
                data: { message: "from i to su obavezni (YYYY-MM-DD ili DD/MM/YYYY)" },
            });
        }

        const [prostoriPodaci, partneriPodaci] = await Promise.all([
            dohvatiIzBackofficea("/business_premises"),
            dohvatiIzBackofficea("/partners"),
        ]);
        const partneri = partneriPodaci.partners || [];
        // Samo prodajna mjesta koja su označena kao partnerska i vezana na
        // partnera. Neoznačeno mjesto je naše i nema provizije.
        const partnerskiProstori = (prostoriPodaci.business_premises || [])
            .filter((p) => p.bp_own === "PARTNER_BP" && p.partner_uuid)
            .filter((p) => !partner_uuid || p.partner_uuid === partner_uuid);

        if (!partnerskiProstori.length) {
            return res.send({
                status: 200,
                data: { from, to, partners: [], totals: { tickets: 0, gross: 0, base: 0, commission: 0 } },
            });
        }

        // Razdoblje se mjeri po izdavanju karte, ne po polasku — obračunava se
        // prodaja koja se dogodila, a polazak zna biti mjesecima kasnije.
        const karte = await TicketsModel.findAll({
            where: {
                business_premise_uuid: { [Op.in]: partnerskiProstori.map((p) => p.uuid) },
                [Op.or]: [{ is_canceled: false }, { is_canceled: null }],
                createdAt: { [Op.between]: [od, doo] },
            },
            order: [["createdAt", "ASC"]],
        });

        const poProstoru = new Map(partnerskiProstori.map((p) => [p.uuid, p]));
        const poPartneru = new Map();

        for (const red of karte) {
            const k = red.dataValues || red;
            const prostor = poProstoru.get(k.business_premise_uuid);
            if (!prostor) continue;
            const partner = partneri.find((p) => p.uuid === prostor.partner_uuid);
            const pct = Number(partner?.commission_pct) || 0;
            const iznosi = neto(k.single_price);

            if (!poPartneru.has(prostor.partner_uuid)) {
                poPartneru.set(prostor.partner_uuid, {
                    partner_uuid: prostor.partner_uuid,
                    partner_name: partner?.partner_name || prostor.partner_name || "",
                    partner_legal_id: partner?.legal_id || null,
                    commission_pct: pct,
                    tickets: 0,
                    gross: 0,
                    harbor_tax: 0,
                    vat: 0,
                    base: 0,
                    commission: 0,
                    premises: new Map(),
                });
            }
            const zbroj = poPartneru.get(prostor.partner_uuid);
            zbroj.tickets += 1;
            zbroj.gross += iznosi.bruto;
            zbroj.harbor_tax += iznosi.pristojba;
            zbroj.vat += iznosi.pdv;
            zbroj.base += iznosi.osnovica;

            if (!zbroj.premises.has(prostor.uuid)) {
                zbroj.premises.set(prostor.uuid, {
                    business_premise_uuid: prostor.uuid,
                    business_premise_name: prostor.name,
                    tickets: 0,
                    gross: 0,
                    base: 0,
                    commission: 0,
                });
            }
            const poMjestu = zbroj.premises.get(prostor.uuid);
            poMjestu.tickets += 1;
            poMjestu.gross += iznosi.bruto;
            poMjestu.base += iznosi.osnovica;
        }

        // Provizija se računa na zbroj osnovice, ne po karti — zaokruživanje po
        // karti bi na tisuću karata odstupilo od iznosa koji se stvarno plaća.
        const partnersOut = [...poPartneru.values()].map((z) => {
            const base = +z.base.toFixed(2);
            const commission = +((base * z.commission_pct) / 100).toFixed(2);
            const premises = [...z.premises.values()].map((m) => {
                const mBase = +m.base.toFixed(2);
                return {
                    ...m,
                    gross: +m.gross.toFixed(2),
                    base: mBase,
                    commission: +((mBase * z.commission_pct) / 100).toFixed(2),
                };
            });
            return {
                partner_uuid: z.partner_uuid,
                partner_name: z.partner_name,
                partner_legal_id: z.partner_legal_id,
                commission_pct: z.commission_pct,
                tickets: z.tickets,
                gross: +z.gross.toFixed(2),
                harbor_tax: +z.harbor_tax.toFixed(2),
                vat: +z.vat.toFixed(2),
                base,
                commission,
                premises,
            };
        }).sort((a, b) => String(a.partner_name).localeCompare(String(b.partner_name), "hr"));

        const totals = partnersOut.reduce((z, p) => ({
            tickets: z.tickets + p.tickets,
            gross: +(z.gross + p.gross).toFixed(2),
            base: +(z.base + p.base).toFixed(2),
            commission: +(z.commission + p.commission).toFixed(2),
        }), { tickets: 0, gross: 0, base: 0, commission: 0 });

        res.send({ status: 200, data: { from, to, partners: partnersOut, totals } });
    } catch (error) {
        console.log("partnerCommissionController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { partnerCommissionController };
