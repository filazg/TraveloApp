import XLSX from "xlsx-js-style";

// Excel izvoz pregleda karata. Popis se grupira po polasku (linija + vrijeme),
// jer se karte tako i gledaju: "što je prodano na ovom polasku". Traka polaska
// nosi broj karata i iznos, ispod nje idu pojedinačne karte, a na kraju je
// sveukupno. Iznosi su pravi brojevi s formatom, ne tekst, da se u Excelu
// mogu dalje zbrajati.
//
// Stilovi prate isti sustav kao izvoz javne usluge u bus projektu.

const ACCENT = "175BD0";
const BAND = "DCE6F7";
const HEADER_BG = "E8EDF5";
const BORDER = "C7D2E0";

const FMT_EUR = '#,##0.00" €"';
const FMT_INT = "#,##0";

const thin = { style: "thin", color: { rgb: BORDER } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

const sTitle = { font: { bold: true, sz: 15, color: { rgb: "0F172A" } }, alignment: { vertical: "center" } };
const sMeta = { font: { sz: 10, color: { rgb: "64748B" } } };
const sHeader = {
    font: { bold: true, sz: 11, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: HEADER_BG } },
    border: allBorders,
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
};
const sBand = { font: { bold: true, sz: 10, color: { rgb: "0F172A" } }, fill: { fgColor: { rgb: BAND } }, border: allBorders };
const sCell = { font: { sz: 10 }, border: allBorders };
const sTotal = { font: { bold: true, sz: 11 }, border: { ...allBorders, top: { style: "medium", color: { rgb: ACCENT } } } };

// Redoslijed stupaca. Brojčani su namjerno na kraju, da se desno poravnati
// blok drži zajedno.
const COLS = [
    // Isti redoslijed kao u tablici: vrijeme izdavanja prvo.
    { key: "izdano", label: "Izdano", w: 17 },
    { key: "sifra", label: "Šifra karte", w: 16 },
    { key: "linija", label: "Linija", w: 9 },
    { key: "polazak", label: "Polazak", w: 17 },
    { key: "od", label: "Od", w: 18 },
    { key: "do", label: "Do", w: 18 },
    { key: "vrsta", label: "Vrsta karte", w: 16 },
    { key: "kanal", label: "Kanal prodaje", w: 20 },
    { key: "nu", label: "NU", w: 8 },
    { key: "placanje", label: "Plaćanje", w: 14 },
    { key: "racun", label: "Račun", w: 10 },
    { key: "putnik", label: "Putnik", w: 22 },
    { key: "email", label: "E-mail", w: 26 },
    { key: "status", label: "Status", w: 16 },
    { key: "karata", label: "Karata", w: 9, z: FMT_INT },
    { key: "cijena", label: "Iznos (€)", w: 13, z: FMT_EUR },
];

const IDX = Object.fromEntries(COLS.map((c, i) => [c.key, i]));
const N = COLS.length;
// Od ovog stupca nadalje sve je broj i ide desno.
const PRVI_BROJCANI = IDX.karata;

/**
 * Gradi stilizirani workbook iz redaka pregleda karata.
 * @param {Array} karte  redci {sifra, linija, polazak, od, do, vrsta, kanal, nu,
 *                       placanje, racun, putnik, email, status:{label,fg,bg}, cijena}
 * @param {object} opts  { kartica, datum, filtri: string[] }
 */
export function buildKarteWorkbook(karte = [], opts = {}) {
    const rows = [];
    const kinds = [];
    const statusi = new Map(); // redak -> boje statusa, primjenjuju se nakon stiliziranja
    const blank = () => new Array(N).fill("");
    const push = (row, kind) => { rows.push(row); kinds.push(kind); return rows.length - 1; };

    const ukupno = karte.reduce((z, k) => z + (Number(k.cijena) || 0), 0);

    const r0 = blank();
    r0[0] = `Pregled karata — ${opts.kartica || "sve"}`;
    push(r0, "title");
    const r1 = blank();
    r1[0] = (opts.filtri || []).filter(Boolean).join(" · ") || "bez dodatnih filtara";
    push(r1, "meta");
    const r2 = blank();
    r2[0] = `Karata: ${karte.length} · Ukupan iznos: ${ukupno.toFixed(2)} €`;
    push(r2, "meta");
    push(blank(), "blank");

    push(COLS.map((c) => c.label), "header");

    // Grupiranje po polasku. Redoslijed grupa je onaj kojim su karte stigle iz
    // pretrage, pa izvoz izgleda kao i tablica na ekranu.
    const grupe = new Map();
    for (const k of karte) {
        const kljuc = `${k.linija || ""}|${k.polazak || ""}`;
        if (!grupe.has(kljuc)) grupe.set(kljuc, { linija: k.linija || "", polazak: k.polazak || "", karte: [] });
        grupe.get(kljuc).karte.push(k);
    }

    for (const g of grupe.values()) {
        const iznos = g.karte.reduce((z, k) => z + (Number(k.cijena) || 0), 0);
        const rb = blank();
        rb[IDX.linija] = g.linija;
        rb[IDX.polazak] = g.polazak || "bez polaska";
        rb[IDX.karata] = g.karte.length;
        rb[IDX.cijena] = +iznos.toFixed(2);
        push(rb, "band");

        for (const k of g.karte) {
            const rk = blank();
            rk[IDX.sifra] = k.sifra || "";
            rk[IDX.od] = k.od || "";
            rk[IDX.do] = k.do || "";
            rk[IDX.vrsta] = k.vrsta || "";
            rk[IDX.kanal] = k.kanal || "";
            rk[IDX.nu] = k.nu || "";
            rk[IDX.placanje] = k.placanje || "";
            rk[IDX.racun] = k.racun || "";
            rk[IDX.izdano] = k.izdano || "";
            rk[IDX.putnik] = k.putnik || "";
            rk[IDX.email] = k.email || "";
            rk[IDX.status] = k.status?.label || "";
            rk[IDX.cijena] = Number(k.cijena) || 0;
            const r = push(rk, "cell");
            if (k.status?.bg) statusi.set(r, k.status);
        }
    }

    const rg = blank();
    rg[0] = "SVEUKUPNO";
    rg[IDX.karata] = karte.length;
    rg[IDX.cijena] = +ukupno.toFixed(2);
    push(rg, "total");

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const styleFor = { title: sTitle, meta: sMeta, header: sHeader, band: sBand, cell: sCell, total: sTotal };

    for (let r = 0; r < rows.length; r++) {
        const kind = kinds[r];
        if (kind === "blank") continue;
        for (let c = 0; c < N; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) ws[addr] = { t: "s", v: "" };
            ws[addr].s = styleFor[kind];
            const z = COLS[c].z;
            if (z && ws[addr].t === "n") ws[addr].z = z;
            if (["band", "cell", "total"].includes(kind) && c >= PRVI_BROJCANI) {
                ws[addr].s = { ...styleFor[kind], alignment: { horizontal: "right" } };
            }
        }
        // Status zadržava boju koju ima i na ekranu — popis se tako čita jednako
        // u Excelu kao u portalu.
        const boje = statusi.get(r);
        if (boje) {
            const addr = XLSX.utils.encode_cell({ r, c: IDX.status });
            ws[addr].s = {
                ...sCell,
                font: { sz: 10, bold: true, color: { rgb: String(boje.fg || "#000000").replace("#", "").toUpperCase() } },
                fill: { fgColor: { rgb: String(boje.bg || "#FFFFFF").replace("#", "").toUpperCase() } },
                alignment: { horizontal: "center" },
            };
        }
    }

    ws["!cols"] = COLS.map((c) => ({ wch: c.w }));
    ws["!rows"] = rows.map((_, r) => (kinds[r] === "title" ? { hpt: 22 } : kinds[r] === "header" ? { hpt: 26 } : {}));
    ws["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: N - 1 } }));
    // Autofilter na zaglavlju tablice (redak 5 u 1-based zapisu).
    ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: 4, c: 0 })}:${XLSX.utils.encode_cell({ r: rows.length - 1, c: N - 1 })}` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Karte");
    return wb;
}

export function karteFileName(opts = {}) {
    const dio = opts.sifra || `${opts.datum || ""}_${opts.karticaKey || "sve"}`;
    return `karte_${dio}.xlsx`;
}
