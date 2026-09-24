// Slanje SEOP dojava iz transactions-servisa prema akd servisu, uz životni
// ciklus (seopLifecycle) kao branu. Sve je "best-effort": neuspjeh NE ruši
// prodaju/validaciju — dojava je posao koji se može ponoviti, a evidencija
// (seop_ipk / seop_cvikanje_transakcija) upisuje se tek kad SEOP potvrdi.
//
// Ovdje je i mapiranje s naše karte na SEOP parametre. Dva su poznata gapa koja
// za PPK (otočne) prolaze, a za OPK treba doraditi: oznake luka (SEOP traži
// vlastite HR-kodove) i `namjena` za običnu kartu (katNamjenaOPK).
const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");
const { smijeRadnju } = require("./seopLifecycle");

const zapisi = (...d) => console.log("[seop-dispatch]", ...d);

async function akdBase() {
    const cfg = await getCoreServiceConfigData();
    return cfg?.services?.akd?.url || null;
}

async function pozovi(putanja, tijelo) {
    const base = await akdBase();
    if (!base) throw new Error("akd servis nije konfiguriran");
    // SEOP zna biti spor — DojaviProdaja u testu traje ~15s. Prekratki timeout
    // je opasan: klijent odustane, a SEOP posao dovrši → dupla dojava bez
    // spremljenog IPK-a. Zato velikodušan timeout (dojava je ionako u pozadini).
    const r = await axios.post(base + putanja, tijelo, { timeout: 45000, validateStatus: () => true });
    return r.data?.data ?? r.data ?? {};
}

// Podaci za zapis poziva (Sistem → AKD log). Dojavu šalje poslužitelj, ali
// uvijek za konkretnu kartu — pa se uz nju bilježi i s kojeg je uređaja karta
// prodana, koja je iskaznica na njoj i na kojoj je liniji. Bez toga se u logu
// vidi samo da je „nešto" dojavljeno.
const kontekstKarte = (t) => ({
    terminal_uuid: t?.billing_device_uuid || null,
    terminal_tid: t?.billing_device_tid || null,
    terminal_naziv: t?.billing_device_name || null,
    izvor: "servis",
    iskaznica: t?.seop_card_no || null,
    id_vrsta: t?.seop_id_vrsta || null,
    line_no: t?.line_code || null,
    relacija: t?.departure_harbor_id && t?.arrival_harbor_id
        ? `${t.departure_harbor_id} - ${t.arrival_harbor_id}`
        : null,
});

// Otočna/povlaštena karta ide kroz PPK, sve ostalo kroz OPK.
const jePovlastena = (t) => t?.seop_sustav === "SEOP" || !!t?.seop_card_no;

// Identifikator putnika za PPK, po vrsti koju je karta zapamtila.
function identifikator(t) {
    const v = t?.seop_card_no || null;
    switch (t?.seop_id_vrsta) {
        case "oib": return { oib: v };
        case "iks": return { iks: v };
        case "uid": return { oznOtIs: v };
        case "reg_oznaka": return { regOzn: v };
        default: return { sBrOtIs: v }; // card_no i fallback
    }
}

// --- prodaja -------------------------------------------------------------
// ctx: { datIzd, oznPristupTocke } — datum izdavanja računa i oznaka pristupne
// točke (naplatni uređaj); ono što karta sama ne nosi.
async function dispatchProdaja(TicketsModel, t, ctx = {}) {
    const g = smijeRadnju(t, "prodaja");
    if (!g.smije) { zapisi("prodaja preskočena:", t.ticket_code, "-", g.razlog); return; }

    const povlastena = jePovlastena(t);
    const zajednicko = {
        oznPlovKarte: t.ticket_code,
        oznLuke1: t.departure_harbor_id,
        oznLuke2: t.arrival_harbor_id,
        brLinije: t.line_code,
        datIzd: ctx.datIzd || t.createdAt || new Date().toISOString(),
        datPut: t.departure_planed || t.departure,
        redovCijena: t.seop_redovna_cijena ?? t.single_price,
        namjena: t.seop_namjena,
        oznPristupTocke: ctx.oznPristupTocke || "",
        visestruka: false,
        masa: null,
        kontekst: kontekstKarte(t),
    };

    try {
        let odgovor;
        if (povlastena) {
            odgovor = await pozovi("/seop/dojavi-prodaju-ppk", {
                ...zajednicko,
                ...identifikator(t),
                povlaCijena: t.single_price,
                oznOdobrenja: t.seop_odobrenje || null,
                uvijekProdaj: !!t.seop_uvijek_prodaj,
            });
        } else {
            odgovor = await pozovi("/seop/dojavi-prodaju-opk", zajednicko);
        }
        if (odgovor?.preskoceno) { zapisi("prodaja isključena prekidačem:", t.ticket_code, "-", odgovor.poruka); return; }
        if (odgovor?.ok && odgovor.ipk) {
            await TicketsModel.update({ seop_ipk: odgovor.ipk }, { where: { ticket_uuid: t.ticket_uuid } });
            zapisi("prodaja OK:", t.ticket_code, "IPK", odgovor.ipk);
            // Vraćamo IPK da ga pozivatelj može odmah ulančati u cvikanje kad je
            // karta auto-validirana pri prodaji (sale = ukrcaj).
            return odgovor.ipk;
        } else {
            zapisi("prodaja odbijena:", t.ticket_code, "-", odgovor?.poruka || odgovor?.seop_kod || "nepoznato");
        }
    } catch (e) {
        zapisi("prodaja greška (ostaje za ponovni pokušaj):", t.ticket_code, "-", e?.message || e);
    }
}

// --- cvikanje (ukrcaj) ---------------------------------------------------
async function dispatchCvikanje(TicketsModel, t, { vremTros, voyageID } = {}) {
    const g = smijeRadnju(t, "cvikanje");
    if (!g.smije) { zapisi("cvikanje preskočeno:", t.ticket_code, "-", g.razlog); return; }
    try {
        const odgovor = await pozovi("/seop/dojavi-cvikanje", {
            ipk: t.seop_ipk,
            vremTros: vremTros || new Date().toISOString(),
            voyageID: voyageID || t.departure_uuid || t.voyage_id || null,
            povlastena: jePovlastena(t),
            kontekst: kontekstKarte(t),
        });
        if (odgovor?.preskoceno) { zapisi("cvikanje isključeno prekidačem:", t.ticket_code); return; }
        if (odgovor?.ok && odgovor.transakcija) {
            await TicketsModel.update({ seop_cvikanje_transakcija: odgovor.transakcija }, { where: { ticket_uuid: t.ticket_uuid } });
            zapisi("cvikanje OK:", t.ticket_code, "tr.", odgovor.transakcija);
        } else {
            zapisi("cvikanje odbijeno:", t.ticket_code, "-", odgovor?.poruka || odgovor?.seop_kod);
        }
    } catch (e) {
        zapisi("cvikanje greška:", t.ticket_code, "-", e?.message || e);
    }
}

// --- storno prodaje (neiskorištena karta) --------------------------------
async function dispatchStorno(TicketsModel, t) {
    const g = smijeRadnju(t, "storno");
    if (!g.smije) { zapisi("storno preskočen:", t.ticket_code, "-", g.razlog); return; }
    try {
        // Storno = DojaviCvikanje bez vremTros.
        const odgovor = await pozovi("/seop/dojavi-cvikanje", { ipk: t.seop_ipk });
        if (odgovor?.preskoceno) { zapisi("storno isključen prekidačem:", t.ticket_code); return; }
        if (odgovor?.ok) zapisi("storno OK:", t.ticket_code, "tr.", odgovor.transakcija);
        else zapisi("storno odbijen:", t.ticket_code, "-", odgovor?.poruka || odgovor?.seop_kod);
    } catch (e) {
        zapisi("storno greška:", t.ticket_code, "-", e?.message || e);
    }
}

// --- poništenje ukrcaja --------------------------------------------------
async function dispatchPonistenje(TicketsModel, t) {
    const g = smijeRadnju(t, "ponistenje");
    if (!g.smije) { zapisi("poništenje preskočeno:", t.ticket_code, "-", g.razlog); return; }
    try {
        const odgovor = await pozovi("/seop/ponisti-cvikanje", { ipk: t.seop_ipk, povlastena: jePovlastena(t), kontekst: kontekstKarte(t) });
        if (odgovor?.preskoceno) { zapisi("poništenje isključeno prekidačem:", t.ticket_code); return; }
        if (odgovor?.ok) {
            // Pravo vraćeno — karta opet samo „prodano".
            await TicketsModel.update({ seop_cvikanje_transakcija: null }, { where: { ticket_uuid: t.ticket_uuid } });
            zapisi("poništenje OK:", t.ticket_code, "tr.", odgovor.transakcija);
        } else {
            zapisi("poništenje odbijeno:", t.ticket_code, "-", odgovor?.poruka || odgovor?.seop_kod);
        }
    } catch (e) {
        zapisi("poništenje greška:", t.ticket_code, "-", e?.message || e);
    }
}

module.exports = { dispatchProdaja, dispatchCvikanje, dispatchStorno, dispatchPonistenje };
