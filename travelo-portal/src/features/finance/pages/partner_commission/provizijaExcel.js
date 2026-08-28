import XLSX from "xlsx-js-style";

// Obračun provizije partnerima koji prodaju u naše ime.
//
// Za razliku od partnerskog računa, ovdje mi dugujemo partneru: on je prodavao
// na našem prodajnom mjestu, novac je naš, a njemu pripada provizija. Izvještaj
// je podloga za plaćanje, pa uz iznos nosi i kako se do njega došlo — promet,
// osnovicu i postotak.

const ACCENT = "175BD0";
const BAND = "DCE6F7";
const HEADER_BG = "E8EDF5";
const BORDER = "C7D2E0";

const FMT_EUR = '#,##0.00" €"';

const thin = { style: "thin", color: { rgb: BORDER } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

const sTitle = { font: { bold: true, sz: 15, color: { rgb: "0F172A" } } };
const sMeta = { font: { sz: 10, color: { rgb: "64748B" } } };
const sPartner = {
    font: { bold: true, sz: 12, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: BAND } },
    border: allBorders,
    alignment: { vertical: "center" },
};
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
const c = (v, s) => ({ v: Number(v || 0), t: "n", s });

const hrDatum = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(iso || "");
};

export function izveziObracunProvizije({ partneri = [], totals = {}, from, to, partner }) {
    const redci = [];

    redci.push([t("OBRAČUN PROVIZIJE PARTNERIMA", sTitle)]);
    redci.push([t(`Razdoblje: ${hrDatum(from)} – ${hrDatum(to)}`, sMeta)]);
    redci.push([t("Osnovica je bez lučke pristojbe i bez PDV-a. Obuhvaćena je prodaja s partnerskih prodajnih mjesta, po datumu izdavanja karte.", sMeta)]);
    redci.push([]);

    for (const p of partneri) {
        redci.push([
            t(`${p.partner_name}${p.partner_legal_id ? ` · OIB ${p.partner_legal_id}` : ""}`, sPartner),
            t("", sPartner),
            t("", sPartner),
            t("", sPartner),
            t(`provizija ${Number(p.commission_pct)} %`, { ...sPartner, alignment: { horizontal: "right" } }),
        ]);
        redci.push([
            t("Prodajno mjesto", sHeader),
            t("Karata", sHeader),
            t("Promet", sHeader),
            t("Osnovica", sHeader),
            t("Provizija", sHeader),
        ]);
        for (const m of p.premises || []) {
            redci.push([
                t(m.business_premise_name, sCell),
                c(m.tickets, sCellNum),
                n(m.gross, sCellNum),
                n(m.base, sCellNum),
                n(m.commission, sCellNum),
            ]);
        }
        redci.push([
            t("Ukupno za partnera", sTotal),
            c(p.tickets, sTotalNum),
            n(p.gross, sTotalNum),
            n(p.base, sTotalNum),
            n(p.commission, sTotalNum),
        ]);
        redci.push([]);
    }

    if (partneri.length > 1) {
        redci.push([
            t("SVEUKUPNO", sTotal),
            c(totals.tickets, sTotalNum),
            n(totals.gross, sTotalNum),
            n(totals.base, sTotalNum),
            n(totals.commission, sTotalNum),
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(redci);
    ws["!cols"] = [{ wch: 38 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Provizija");
    const naziv = partner?.partner_name
        ? `Provizija_${partner.partner_name.replace(/[^\w\-]+/g, "_")}_${from}_${to}.xlsx`
        : `Provizija_partneri_${from}_${to}.xlsx`;
    XLSX.writeFile(wb, naziv);
}
