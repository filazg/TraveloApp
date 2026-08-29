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

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DANI = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];

// Razdoblje obračuna proizlazi iz dinamike naplate partnera — uvijek zadnje
// zaokruženo razdoblje, ono za koje se obračun radi. Blagajnik ga zato ne
// upisuje: dinamika je dogovorena s partnerom i stoji u šifarniku.
const razdobljePoDinamici = (partner, danasnji = new Date(), tekuce = false) => {
    const danas = new Date(danasnji.getFullYear(), danasnji.getMonth(), danasnji.getDate());
    const cycle = String(partner?.billing_cycle || "MONTHLY").toUpperCase();

    // Tekuće razdoblje — ono koje još traje. Ne služi za isplatu nego za uvid
    // usred razdoblja: koliko je partner zaradio dosad. Iznos nije konačan jer
    // se prodaja još događa.
    if (tekuce) {
        if (cycle === "SEMI_MONTHLY") {
            const od = danas.getDate() >= 16
                ? new Date(danas.getFullYear(), danas.getMonth(), 16)
                : new Date(danas.getFullYear(), danas.getMonth(), 1);
            return { from: iso(od), to: iso(danas), cycle, label: "Tekuće razdoblje — u tijeku", running: true };
        }
        if (cycle === "WEEKLY") {
            const dan = Number(partner?.billing_weekday) || 1;
            const danasISO = danas.getDay() === 0 ? 7 : danas.getDay();
            let nazad = danasISO - dan;
            if (nazad < 0) nazad += 7;
            const zadnjiObracun = new Date(danas.getFullYear(), danas.getMonth(), danas.getDate() - nazad);
            return { from: iso(zadnjiObracun), to: iso(danas), cycle, label: "Tekuće razdoblje — u tijeku", running: true };
        }
        const od = new Date(danas.getFullYear(), danas.getMonth(), 1);
        return { from: iso(od), to: iso(danas), cycle: "MONTHLY", label: "Tekuće razdoblje — u tijeku", running: true };
    }

    if (cycle === "SEMI_MONTHLY") {
        // Obračun je 1. i 16.: nakon 16. u mjesecu zaokružena je prva polovica
        // tekućeg mjeseca, prije toga druga polovica prethodnog.
        if (danas.getDate() >= 16) {
            const od = new Date(danas.getFullYear(), danas.getMonth(), 1);
            const doo = new Date(danas.getFullYear(), danas.getMonth(), 15);
            return { from: iso(od), to: iso(doo), cycle, label: "Dvomjesečno — prva polovica mjeseca" };
        }
        const prosli = new Date(danas.getFullYear(), danas.getMonth() - 1, 1);
        const od = new Date(prosli.getFullYear(), prosli.getMonth(), 16);
        const doo = new Date(danas.getFullYear(), danas.getMonth(), 0);
        return { from: iso(od), to: iso(doo), cycle, label: "Dvomjesečno — druga polovica prethodnog mjeseca" };
    }

    if (cycle === "WEEKLY") {
        // Dan obračuna je ISO dan (1 = ponedjeljak). Uzima se zadnji takav dan
        // koji je nastupio, a razdoblje je sedam dana prije njega.
        const dan = Number(partner?.billing_weekday) || 1;
        const danasISO = danas.getDay() === 0 ? 7 : danas.getDay();
        let nazad = danasISO - dan;
        if (nazad < 0) nazad += 7;
        const obracun = new Date(danas.getFullYear(), danas.getMonth(), danas.getDate() - nazad);
        const doo = new Date(obracun.getFullYear(), obracun.getMonth(), obracun.getDate() - 1);
        const od = new Date(obracun.getFullYear(), obracun.getMonth(), obracun.getDate() - 7);
        return { from: iso(od), to: iso(doo), cycle, label: `Tjedno — obračun ${DANI[obracun.getDay()]}` };
    }

    const od = new Date(danas.getFullYear(), danas.getMonth() - 1, 1);
    const doo = new Date(danas.getFullYear(), danas.getMonth(), 0);
    return { from: iso(od), to: iso(doo), cycle: "MONTHLY", label: "Mjesečno — prethodni mjesec" };
};

const partnerCommissionController = async (req, res) => {
    const { TicketsModel, InvoiceModel } = req.app.locals.models;
    try {
        const { partner_uuid, period } = req.query || {};
        let { from, to } = req.query || {};

        const [prostoriPodaci, partneriPodaci, tvrtkaPodaci] = await Promise.all([
            dohvatiIzBackofficea("/business_premises"),
            dohvatiIzBackofficea("/partners"),
            // Naziv tvrtke stoji u zaglavlju prvog dijela obracuna: te su karte
            // prodane za nas racun, pa se vidi na ciji racun ide promet.
            dohvatiIzBackofficea("/company"),
        ]);
        const nazivTvrtke = tvrtkaPodaci?.company?.name || "";
        const partneri = partneriPodaci.partners || [];

        // Bez izričitog raspona razdoblje se računa iz dinamike naplate. Kod
        // "svih partnera" mjerodavna je mjesečna dinamika, jer zajednički
        // prikaz ne može slijediti tri različita rasporeda odjednom.
        let razdoblje = null;
        if (!from || !to) {
            const partner = partner_uuid ? partneri.find((p) => p.uuid === partner_uuid) : null;
            razdoblje = razdobljePoDinamici(partner, new Date(), String(period) === "current");
            from = razdoblje.from;
            to = razdoblje.to;
        }

        const od = pocetakDana(from);
        const doo = krajDana(to);
        if (!od || !doo) {
            return res.status(400).json({
                status: 400,
                data: { message: "razdoblje se ne da odrediti — provjeri dinamiku naplate partnera" },
            });
        }
        // Samo prodajna mjesta koja su označena kao partnerska i vezana na
        // partnera. Neoznačeno mjesto je naše i nema provizije.
        const partnerskiProstori = (prostoriPodaci.business_premises || [])
            .filter((p) => p.bp_own === "PARTNER_BP" && p.partner_uuid)
            .filter((p) => !partner_uuid || p.partner_uuid === partner_uuid);

        if (!partnerskiProstori.length) {
            return res.send({
                status: 200,
                data: { from, to, period: razdoblje, company_name: nazivTvrtke, partners: [], partner_channel: null, totals: { tickets: 0, gross: 0, base: 0, commission: 0 } },
            });
        }

        // Prodajno mjesto stoji na RAČUNU, ne na karti — karta zna samo svoju
        // vožnju. Zato se prvo nađu računi partnerskih prodajnih mjesta u
        // razdoblju, pa njihove karte. Razdoblje se mjeri po izdavanju računa,
        // ne po polasku, jer se obračunava prodaja koja se dogodila, a polazak
        // zna biti mjesecima kasnije.
        const racuni = await InvoiceModel.findAll({
            where: {
                invoice_business_premise_uuid: { [Op.in]: partnerskiProstori.map((p) => p.uuid) },
                createdAt: { [Op.between]: [od, doo] },
            },
            attributes: [
                "invoice_uuid", "order_uuid", "invoice_business_premise_uuid",
                "invoice_business_premise_name", "invoice_billing_device_fiscal_mark",
                "invoice_operator_name",
            ],
        });

        if (!racuni.length) {
            return res.send({
                status: 200,
                data: { from, to, period: razdoblje, company_name: nazivTvrtke, partners: [], partner_channel: null, totals: { tickets: 0, gross: 0, base: 0, commission: 0 } },
            });
        }

        // Karta se veže na račun preko invoice_uuid; web prodaja nema
        // invoice_uuid na karti nego order_uuid, pa se hvata i tim putem.
        const prostorPoRacunu = new Map();
        // Uz prodajno mjesto se pamti i naplatni uredaj i operater — obracun se
        // razraduje do osobe koja je prodala, ne samo do mjesta.
        const izvorPoRacunu = new Map();
        const narudzbe = [];
        for (const r of racuni) {
            const izvor = {
                business_premise_name: r.invoice_business_premise_name || "",
                billing_device: r.invoice_billing_device_fiscal_mark || "",
                operator: r.invoice_operator_name || "",
            };
            prostorPoRacunu.set(r.invoice_uuid, r.invoice_business_premise_uuid);
            izvorPoRacunu.set(r.invoice_uuid, izvor);
            for (const o of String(r.order_uuid || "").split(",").map((x) => x.trim()).filter(Boolean)) {
                prostorPoRacunu.set(o, r.invoice_business_premise_uuid);
                izvorPoRacunu.set(o, izvor);
                narudzbe.push(o);
            }
        }

        const karte = await TicketsModel.findAll({
            where: {
                [Op.or]: [
                    { invoice_uuid: { [Op.in]: racuni.map((r) => r.invoice_uuid) } },
                    ...(narudzbe.length ? [{ order_uuid: { [Op.in]: narudzbe } }] : []),
                ],
                [Op.and]: [{ [Op.or]: [{ is_canceled: false }, { is_canceled: null }] }],
            },
            order: [["createdAt", "ASC"]],
        });

        const poProstoru = new Map(partnerskiProstori.map((p) => [p.uuid, p]));
        const poPartneru = new Map();

        for (const red of karte) {
            const k = red.dataValues || red;
            const prostorUuid = prostorPoRacunu.get(k.invoice_uuid) || prostorPoRacunu.get(k.order_uuid);
            const prostor = poProstoru.get(prostorUuid);
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

            // Razrada unutar mjesta: naplatni uredaj i operater. Partner tako
            // vidi tko je prodavao, a ne samo koliko je mjesto prodalo.
            const izvor = izvorPoRacunu.get(k.invoice_uuid) || izvorPoRacunu.get(k.order_uuid) || {};
            const kljucIzvora = `${izvor.billing_device || "-"}|${izvor.operator || "-"}`;
            if (!poMjestu.rows) poMjestu.rows = new Map();
            if (!poMjestu.rows.has(kljucIzvora)) {
                poMjestu.rows.set(kljucIzvora, {
                    billing_device: izvor.billing_device || "",
                    operator: izvor.operator || "",
                    tickets: 0, gross: 0, base: 0,
                });
            }
            const redIzvora = poMjestu.rows.get(kljucIzvora);
            redIzvora.tickets += 1;
            redIzvora.gross += iznosi.bruto;
            redIzvora.base += iznosi.osnovica;
        }

        // Provizija se računa na zbroj osnovice, ne po karti — zaokruživanje po
        // karti bi na tisuću karata odstupilo od iznosa koji se stvarno plaća.
        const partnersOut = [...poPartneru.values()].map((z) => {
            const base = +z.base.toFixed(2);
            const commission = +((base * z.commission_pct) / 100).toFixed(2);
            const premises = [...z.premises.values()].map((m) => {
                const mBase = +m.base.toFixed(2);
                const rows = [...(m.rows ? m.rows.values() : [])].map((r) => {
                    const rBase = +r.base.toFixed(2);
                    return {
                        ...r,
                        gross: +r.gross.toFixed(2),
                        base: rBase,
                        commission: +((rBase * z.commission_pct) / 100).toFixed(2),
                    };
                });
                return {
                    ...m,
                    rows,
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

        // Partnerova vlastita prodaja — karte prodane kroz partnersku prodaju.
        // Njih partner naplacuje od putnika, a nama duguje bruto umanjen za
        // proviziju, sto se obracunava na zbirnom partnerskom racunu. Zato NE
        // ulaze u iznos za isplatu, ali se prikazuju: bez njih partner u
        // obracunu ne vidi dio svoje zarade i cini mu se da prodaja nedostaje.
        let vlastitaProdaja = null;
        if (partner_uuid) {
            const partner = partneri.find((p) => p.uuid === partner_uuid);
            const pct = Number(partner?.commission_pct) || 0;
            const karteKanala = await TicketsModel.findAll({
                where: {
                    partner_uuid,
                    [Op.or]: [{ is_canceled: false }, { is_canceled: null }],
                    createdAt: { [Op.between]: [od, doo] },
                },
            });
            if (karteKanala.length) {
                let bruto = 0;
                let osnovica = 0;
                let obracunato = 0;
                // Razrada po korisniku partnera — tko je od njegovih ljudi
                // prodao. Starije karte nemaju upisanog korisnika, pa idu pod
                // "nepoznato" umjesto da nestanu iz razrade.
                const poKorisniku = new Map();
                for (const red of karteKanala) {
                    const k = red.dataValues || red;
                    const i = neto(k.single_price);
                    bruto += i.bruto;
                    osnovica += i.osnovica;
                    if (k.partner_invoice_uuid) obracunato += 1;
                    const korisnik = k.sold_by_username || "—";
                    if (!poKorisniku.has(korisnik)) {
                        poKorisniku.set(korisnik, { username: korisnik, tickets: 0, gross: 0, base: 0 });
                    }
                    const redK = poKorisniku.get(korisnik);
                    redK.tickets += 1;
                    redK.gross += i.bruto;
                    redK.base += i.osnovica;
                }
                const base = +osnovica.toFixed(2);
                vlastitaProdaja = {
                    partner_uuid,
                    partner_name: partner?.partner_name || "",
                    commission_pct: pct,
                    tickets: karteKanala.length,
                    gross: +bruto.toFixed(2),
                    base,
                    commission: +((base * pct) / 100).toFixed(2),
                    // Koliko ih je vec uslo u zbirni partnerski racun.
                    invoiced: obracunato,
                    rows: [...poKorisniku.values()].map((r) => {
                        const rBase = +r.base.toFixed(2);
                        return {
                            ...r,
                            gross: +r.gross.toFixed(2),
                            base: rBase,
                            commission: +((rBase * pct) / 100).toFixed(2),
                        };
                    }).sort((a, b) => String(a.username).localeCompare(String(b.username), "hr")),
                };
            }
        }

        const totals = partnersOut.reduce((z, p) => ({
            tickets: z.tickets + p.tickets,
            gross: +(z.gross + p.gross).toFixed(2),
            base: +(z.base + p.base).toFixed(2),
            commission: +(z.commission + p.commission).toFixed(2),
        }), { tickets: 0, gross: 0, base: 0, commission: 0 });

        res.send({ status: 200, data: { from, to, period: razdoblje, company_name: nazivTvrtke, partners: partnersOut, partner_channel: vlastitaProdaja, totals } });
    } catch (error) {
        console.log("partnerCommissionController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { partnerCommissionController };
