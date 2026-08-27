import XLSX from "xlsx-js-style";

// Izvještaj o povratima za kartičarsku kuću. Ona povrat provodi po izvornoj
// transakciji, pa su nosivi podaci terminal, autorizacijski kod i referenca —
// bez njih ne može spojiti povrat s naplatom.
//
// Stilovi prate isti sustav kao ostali izvozi u portalu.

const ACCENT = "175BD0";
const HEADER_BG = "E8EDF5";
const BORDER = "C7D2E0";

const FMT_EUR = '#,##0.00" €"';

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
const sCell = { font: { sz: 10 }, border: allBorders };
const sMono = { font: { sz: 10, name: "Consolas" }, border: allBorders };
const sTotal = { font: { bold: true, sz: 11 }, border: { ...allBorders, top: { style: "medium", color: { rgb: ACCENT } } } };

const COLS = [
    { key: "datum", label: "Datum povrata", w: 17 },
    { key: "storno", label: "Storno račun", w: 20 },
    { key: "izvorni", label: "Izvorni račun", w: 14 },
    { key: "transakcija", label: "Datum transakcije", w: 17 },
    { key: "terminal", label: "Terminal (TID)", w: 15, mono: true },
    { key: "auth", label: "Autorizacija", w: 14, mono: true },
    { key: "referenca", label: "Referenca transakcije", w: 24, mono: true },
    { key: "kartica", label: "Kartica", w: 20, mono: true },
    { key: "vrsta", label: "Vrsta kartice", w: 15 },
    { key: "karte", label: "Karte", w: 22 },
    { key: "iznos", label: "Iznos povrata (€)", w: 17, z: FMT_EUR },
];

const IDX = Object.fromEntries(COLS.map((c, i) => [c.key, i]));
const N = COLS.length;

const fmtDateTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
};

// Terminal vraća datum kao "DDMMYY" — kartičarskoj kući se piše čitljivo.
const fmtTransakcija = (v) => {
    const s = String(v || "");
    const m = /^(\d{2})(\d{2})(\d{2})$/.exec(s);
    if (m) return `${m[1]}.${m[2]}.20${m[3]}.`;
    return fmtDateTime(s) || s;
};

/**
 * @param {object} order  nalog (name, provider, status, closed_at, created_by)
 * @param {Array}  items  stavke naloga
 * @param {object} opts   { companyName, providerLabel }
 */
export function buildNalogWorkbook(order, items = [], opts = {}) {
    const rows = [];
    const kinds = [];
    const blank = () => new Array(N).fill("");
    const push = (row, kind) => { rows.push(row); kinds.push(kind); };

    const ukupno = items.reduce((z, s) => z + (Number(s.amount) || 0), 0);

    const r0 = blank();
    r0[0] = `Nalog za povrat — ${opts.providerLabel || order?.provider || ""}`;
    push(r0, "title");
    const r1 = blank();
    r1[0] = `${order?.name || ""} · ${opts.companyName || ""}`;
    push(r1, "meta");
    const r2 = blank();
    r2[0] = `Povrata: ${items.length} · Ukupno za povrat: ${ukupno.toFixed(2)} €`
        + (order?.closed_at ? ` · Nalog zatvoren: ${fmtDateTime(order.closed_at)}` : " · Nalog još otvoren");
    push(r2, "meta");
    push(blank(), "blank");

    push(COLS.map((c) => c.label), "header");

    for (const s of items) {
        const r = blank();
        r[IDX.datum] = fmtDateTime(s.createdAt);
        r[IDX.storno] = s.storno_invoice_code || "";
        r[IDX.izvorni] = s.original_invoice_no || "";
        r[IDX.transakcija] = fmtTransakcija(s.transaction_date);
        r[IDX.terminal] = s.terminal_id || "";
        r[IDX.auth] = s.auth_code || "";
        r[IDX.referenca] = s.transaction_reference || "";
        r[IDX.kartica] = s.card_mask || "";
        r[IDX.vrsta] = s.card_type || "";
        r[IDX.karte] = s.ticket_codes || "";
        r[IDX.iznos] = Number(s.amount) || 0;
        push(r, "cell");
    }

    const rt = blank();
    rt[0] = "UKUPNO";
    rt[IDX.iznos] = +ukupno.toFixed(2);
    push(rt, "total");

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const styleFor = { title: sTitle, meta: sMeta, header: sHeader, cell: sCell, total: sTotal };

    for (let r = 0; r < rows.length; r++) {
        const kind = kinds[r];
        if (kind === "blank") continue;
        for (let c = 0; c < N; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) ws[addr] = { t: "s", v: "" };
            // Brojevi kartica, autorizacije i reference čitaju se znak po znak,
            // pa idu u fiksnoj širini.
            ws[addr].s = (kind === "cell" && COLS[c].mono) ? sMono : styleFor[kind];
            const z = COLS[c].z;
            if (z && ws[addr].t === "n") ws[addr].z = z;
            if (["cell", "total"].includes(kind) && c === IDX.iznos) {
                ws[addr].s = { ...ws[addr].s, alignment: { horizontal: "right" } };
            }
        }
    }

    ws["!cols"] = COLS.map((c) => ({ wch: c.w }));
    ws["!rows"] = rows.map((_, r) => (kinds[r] === "title" ? { hpt: 22 } : kinds[r] === "header" ? { hpt: 26 } : {}));
    ws["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: N - 1 } }));
    ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: 4, c: 0 })}:${XLSX.utils.encode_cell({ r: rows.length - 1, c: N - 1 })}` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Povrati");
    return wb;
}

export function nalogFileName(order) {
    const naziv = String(order?.name || "nalog")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
        .slice(0, 40) || "nalog";
    const provider = String(order?.provider || "").toLowerCase().replace(/_/g, "-");
    return `povrati-${provider}-${naziv}.xlsx`;
}
