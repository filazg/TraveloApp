import XLSX from "xlsx-js-style";

// Detalji obračuna provizije.
//
// Zbroj u obračunu kaže koliko, a ovaj popis kada i što: bez njega se iznos ne
// može provjeriti ni objasniti partneru kad pita otkud brojka. Isti izvoz služi
// i za cijelo razdoblje i za jedan redak razrade — razlikuju se samo u tome
// koje retke dobiju i što piše u zaglavlju.
//
// Dva se dijela čitaju različito, pa idu u zasebne listove:
//  • naš račun — prodaja na partnerskom prodajnom mjestu, gleda se karta po
//    karta, kao i svaki drugi promet naše blagajne;
//  • vlastiti račun — partnerova prodaja, gleda se po prodaji: partner je
//    prodao jednom kupcu nekoliko karata odjednom i uz njih upisao napomenu po
//    kojoj tu prodaju kasnije prepoznaje. Rastavljeno po kartama napomena se
//    ponavlja, a prodaja se gubi.

const ACCENT = "175BD0";
const HEADER_BG = "E8EDF5";
const BORDER = "C7D2E0";

const FMT_EUR = '#,##0.00" €"';

const thin = { style: "thin", color: { rgb: BORDER } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

const sTitle = { font: { bold: true, sz: 15, color: { rgb: "0F172A" } } };
const sMeta = { font: { sz: 10, color: { rgb: "64748B" } } };
const sHeader = {
    font: { bold: true, sz: 11, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: HEADER_BG } },
    border: allBorders,
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
};
const sCell = { font: { sz: 10 }, border: allBorders, alignment: { vertical: "top" } };
const sCellWrap = { ...sCell, alignment: { vertical: "top", wrapText: true } };
const sCellNum = { ...sCell, alignment: { vertical: "top", horizontal: "right" } };
const sTotal = { font: { bold: true, sz: 11 }, border: { ...allBorders, top: { style: "medium", color: { rgb: ACCENT } } } };
const sTotalNum = { ...sTotal, alignment: { horizontal: "right" } };

const t = (v, s) => ({ v: v ?? "", t: "s", s });
const n = (v, s) => ({ v: Number(v || 0), t: "n", z: FMT_EUR, s });
// Broj karata nosi svoj zapis izricito: stil se dijeli s iznosima, pa bi inace
// preuzeo njihov format i "5 karata" bi se ispisalo kao "5,00 €".
const c = (v, s) => ({ v: Number(v || 0), t: "n", z: "0", s: { ...s } });

const hrDatum = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(iso || "");
};

// Vrijeme prodaje je ISO s poslužitelja; prikazuje se lokalno, jer partner
// gleda kad je njegov čovjek prodao, ne kad je zapisano u UTC-u.
const hrVrijeme = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    return d.toLocaleString("hr-HR");
};

// "1 karta, 2 karte, 5 karata" — zbroj se čita naglas na sastanku s partnerom.
const mnozina = (broj, [jedan, malo, puno]) => {
    const k = broj % 10;
    const s = broj % 100;
    if (k === 1 && s !== 11) return `${broj} ${jedan}`;
    if (k >= 2 && k <= 4 && (s < 12 || s > 14)) return `${broj} ${malo}`;
    return `${broj} ${puno}`;
};

const relacija = (r) => [r.departure_harbor_name, r.arrival_harbor_name].filter(Boolean).join(" – ");
const jedinstveno = (vrijednosti) => [...new Set(vrijednosti.filter(Boolean))].join(", ");

const zbroji = (redci) => ({
    gross: redci.reduce((z, r) => z + (Number(r.gross) || 0), 0),
    base: redci.reduce((z, r) => z + (Number(r.base) || 0), 0),
    commission: redci.reduce((z, r) => z + (Number(r.commission) || 0), 0),
});

const zaglavlje = (izlaz, stupaca, { partner, from, to, opis, podnaslov }) => {
    izlaz.push([t("DETALJI OBRAČUNA PROVIZIJE", sTitle)]);
    izlaz.push([t(`${partner || ""} · razdoblje ${hrDatum(from)} – ${hrDatum(to)}`, sMeta)]);
    izlaz.push([t([podnaslov, opis].filter(Boolean).join(" · "), sMeta)]);
    izlaz.push([]);
    return [
        { s: { r: 0, c: 0 }, e: { r: 0, c: stupaca - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: stupaca - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: stupaca - 1 } },
    ];
};

// --- naš račun: karta po karta ----------------------------------------------

const listNasRacun = (redci, meta) => {
    const izlaz = [];
    const merges = zaglavlje(izlaz, 12, { ...meta, podnaslov: "Prodaja za naš račun" });

    izlaz.push([
        t("Prodano", sHeader),
        t("Prodajno mjesto", sHeader),
        t("Uređaj", sHeader),
        t("Operater", sHeader),
        t("Oznaka karte", sHeader),
        t("Vrsta", sHeader),
        t("Linija", sHeader),
        t("Relacija", sHeader),
        t("Polazak", sHeader),
        t("Cijena", sHeader),
        t("Osnovica", sHeader),
        t("Provizija", sHeader),
    ]);

    for (const r of redci) {
        izlaz.push([
            t(hrVrijeme(r.sold_at), sCell),
            t(r.business_premise_name, sCell),
            t(r.billing_device, sCell),
            t(r.operator, sCell),
            t(r.ticket_code, sCell),
            t(r.ticket_type_name, sCell),
            t(r.line_name, sCell),
            t(relacija(r), sCell),
            t(r.departure_planed, sCell),
            n(r.gross, sCellNum),
            n(r.base, sCellNum),
            n(r.commission, sCellNum),
        ]);
    }

    const uk = zbroji(redci);
    izlaz.push([
        t(`UKUPNO (${mnozina(redci.length, ["karta", "karte", "karata"])})`, sTotal),
        ...Array.from({ length: 8 }, () => t("", sTotal)),
        n(uk.gross, sTotalNum),
        n(uk.base, sTotalNum),
        n(uk.commission, sTotalNum),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(izlaz);
    ws["!cols"] = [
        { wch: 19 }, { wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 12 },
        { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    ws["!merges"] = merges;
    ws["!freeze"] = { xSplit: 0, ySplit: 5 };
    return ws;
};

// --- vlastiti račun: po prodaji ---------------------------------------------

// Prodaja je ono što je partner napravio u jednom potezu: jedna narudžba, jedan
// kupac, jedna napomena, više karata. Grupira se po narudžbi; ako je nema (stare
// karte), karta stoji sama za sebe.
const poProdaji = (redci) => {
    const grupe = new Map();
    for (const r of redci) {
        const kljuc = r.order_uuid || r.order_number || `karta:${r.ticket_code}`;
        if (!grupe.has(kljuc)) grupe.set(kljuc, []);
        grupe.get(kljuc).push(r);
    }
    return [...grupe.values()].sort((a, b) => String(a[0].sold_at).localeCompare(String(b[0].sold_at)));
};

// "2 × Odrasli · 1 × Dijete" — što je točno prodano, bez rastavljanja prodaje.
const sastav = (grupa) => {
    const broj = new Map();
    for (const r of grupa) {
        const v = r.ticket_type_name || "—";
        broj.set(v, (broj.get(v) || 0) + 1);
    }
    return [...broj.entries()].map(([v, k]) => `${k} × ${v}`).join(" · ");
};

const listVlastitiRacun = (redci, meta) => {
    const izlaz = [];
    const merges = zaglavlje(izlaz, 14, { ...meta, podnaslov: "Partnerova prodaja za vlastiti račun" });

    izlaz.push([
        t("Prodano", sHeader),
        t("Narudžba", sHeader),
        t("Prodao", sHeader),
        t("Kupac", sHeader),
        t("Napomena", sHeader),
        t("Linija", sHeader),
        t("Relacija", sHeader),
        t("Polazak", sHeader),
        t("Karte", sHeader),
        t("Kom.", sHeader),
        t("Oznake karata", sHeader),
        t("Cijena", sHeader),
        t("Osnovica", sHeader),
        t("Provizija", sHeader),
    ]);

    const grupe = poProdaji(redci);
    for (const g of grupe) {
        const p = g[0];
        const uk = zbroji(g);
        izlaz.push([
            t(hrVrijeme(p.sold_at), sCell),
            t(p.order_number || p.order_uuid, sCell),
            t(p.username || "—", sCell),
            t(jedinstveno(g.map((r) => r.passanger_name)), sCell),
            // Napomena je partnerov trag o prodaji — po njoj prepoznaje agenciju,
            // vaučer ili dogovor, pa se ispisuje uvijek, i kad je prazna.
            t(jedinstveno(g.map((r) => r.order_note)), sCellWrap),
            t(jedinstveno(g.map((r) => r.line_name)), sCell),
            t(jedinstveno(g.map(relacija)), sCell),
            t(jedinstveno(g.map((r) => r.departure_planed)), sCell),
            t(sastav(g), sCellWrap),
            c(g.length, sCellNum),
            t(g.map((r) => r.ticket_code).filter(Boolean).join(", "), sCellWrap),
            n(uk.gross, sCellNum),
            n(uk.base, sCellNum),
            n(uk.commission, sCellNum),
        ]);
    }

    const uk = zbroji(redci);
    izlaz.push([
        t(`UKUPNO (${mnozina(grupe.length, ["prodaja", "prodaje", "prodaja"])}, ${mnozina(redci.length, ["karta", "karte", "karata"])})`, sTotal),
        ...Array.from({ length: 8 }, () => t("", sTotal)),
        c(redci.length, sTotalNum),
        t("", sTotal),
        n(uk.gross, sTotalNum),
        n(uk.base, sTotalNum),
        n(uk.commission, sTotalNum),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(izlaz);
    ws["!cols"] = [
        { wch: 19 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 34 }, { wch: 24 },
        { wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 7 }, { wch: 26 },
        { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    ws["!merges"] = merges;
    ws["!freeze"] = { xSplit: 0, ySplit: 5 };
    return ws;
};

export function izveziDetaljeProvizije({ redci = [], partner, from, to, opis }) {
    const meta = { partner, from, to, opis };
    const nasi = redci.filter((r) => r.scope !== "channel");
    const vlastiti = redci.filter((r) => r.scope === "channel");

    const wb = XLSX.utils.book_new();
    if (nasi.length) XLSX.utils.book_append_sheet(wb, listNasRacun(nasi, meta), "Naš račun");
    if (vlastiti.length) XLSX.utils.book_append_sheet(wb, listVlastitiRacun(vlastiti, meta), "Vlastiti račun");
    if (!wb.SheetNames.length) {
        // Prazno razdoblje i dalje daje datoteku — da se vidi da je provjereno,
        // a ne da preuzimanje tiho ne napravi ništa.
        const prazno = [];
        zaglavlje(prazno, 1, { ...meta, podnaslov: "Nema prodaje u razdoblju" });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prazno), "Detalji");
    }

    const naziv = `Provizija_detalji_${String(partner || "partner").replace(/[^\w-]+/g, "_")}_${from}_${to}.xlsx`;
    XLSX.writeFile(wb, naziv);
}

// Označava koji retci pripadaju jednom retku razrade. Isti ključ vrijedi i za
// našu prodaju (mjesto/uređaj/operater) i za partnerovu (korisnik).
export const pripadaRetku = (r, filtar) => {
    if (!filtar) return true;
    if (filtar.scope && r.scope !== filtar.scope) return false;
    if (filtar.username != null && (r.username || "—") !== filtar.username) return false;
    if (filtar.business_premise_name != null && r.business_premise_name !== filtar.business_premise_name) return false;
    if (filtar.billing_device != null && r.billing_device !== filtar.billing_device) return false;
    if (filtar.operator != null && r.operator !== filtar.operator) return false;
    return true;
};
