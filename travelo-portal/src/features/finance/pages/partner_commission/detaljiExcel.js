import XLSX from "xlsx-js-style";

// Detalji obračuna provizije — karta po karta.
//
// Zbroj u obračunu kaže koliko, a ovaj popis kada i što: bez njega se iznos ne
// može provjeriti ni objasniti partneru kad pita otkud brojka. Isti izvoz služi
// i za cijelo razdoblje i za jedan redak razrade — razlikuju se samo u tome
// koje retke dobiju i što piše u zaglavlju.

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
const sCell = { font: { sz: 10 }, border: allBorders };
const sCellNum = { ...sCell, alignment: { horizontal: "right" } };
const sTotal = { font: { bold: true, sz: 11 }, border: { ...allBorders, top: { style: "medium", color: { rgb: ACCENT } } } };
const sTotalNum = { ...sTotal, alignment: { horizontal: "right" } };

const t = (v, s) => ({ v: v ?? "", t: "s", s });
const n = (v, s) => ({ v: Number(v || 0), t: "n", z: FMT_EUR, s });

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

export function izveziDetaljeProvizije({ redci = [], partner, from, to, opis }) {
    const izlaz = [];

    izlaz.push([t("DETALJI OBRAČUNA PROVIZIJE", sTitle)]);
    izlaz.push([t(`${partner || ""} · razdoblje ${hrDatum(from)} – ${hrDatum(to)}`, sMeta)]);
    if (opis) izlaz.push([t(opis, sMeta)]);
    izlaz.push([]);

    izlaz.push([
        t("Prodano", sHeader),
        t("Izvor", sHeader),
        t("Prodao", sHeader),
        t("Oznaka karte", sHeader),
        t("Vrsta", sHeader),
        t("Linija", sHeader),
        t("Relacija", sHeader),
        t("Polazak", sHeader),
        t("Cijena", sHeader),
        t("Osnovica", sHeader),
        t("Provizija", sHeader),
    ]);

    let bruto = 0;
    let osnovica = 0;
    let provizija = 0;
    for (const r of redci) {
        bruto += Number(r.gross) || 0;
        osnovica += Number(r.base) || 0;
        provizija += Number(r.commission) || 0;
        izlaz.push([
            t(hrVrijeme(r.sold_at), sCell),
            t(r.scope === "channel" ? "vlastiti račun" : "naš račun", sCell),
            // Kod naše prodaje prodavatelj je operater na uređaju, kod partnerske
            // korisnik partnerske prodaje — u istom stupcu, da se popis može
            // čitati odozgo prema dolje bez preskakanja.
            t(r.scope === "channel" ? (r.username || "—") : [r.business_premise_name, r.billing_device, r.operator].filter(Boolean).join(" · "), sCell),
            t(r.ticket_code, sCell),
            t(r.ticket_type_name, sCell),
            t(r.line_name, sCell),
            t([r.departure_harbor_name, r.arrival_harbor_name].filter(Boolean).join(" – "), sCell),
            t(r.departure_planed, sCell),
            n(r.gross, sCellNum),
            n(r.base, sCellNum),
            n(r.commission, sCellNum),
        ]);
    }

    izlaz.push([
        t(`UKUPNO (${redci.length})`, sTotal),
        t("", sTotal), t("", sTotal), t("", sTotal), t("", sTotal),
        t("", sTotal), t("", sTotal), t("", sTotal),
        n(bruto, sTotalNum),
        n(osnovica, sTotalNum),
        n(provizija, sTotalNum),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(izlaz);
    ws["!cols"] = [
        { wch: 19 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 12 },
        { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    ];
    if (opis) ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 10 } });
    // Zaglavlje se drži pri vrhu — popis zna imati stotine redaka.
    ws["!freeze"] = { xSplit: 0, ySplit: opis ? 5 : 4 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalji");
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
