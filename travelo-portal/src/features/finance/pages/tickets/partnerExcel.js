import XLSX from "xlsx-js-style";

// Izvještaj o otkazanim kartama za partnera.
//
// Partnerske karte se ne naplaćuju po prodaji nego zbirnim računom, pa otkaz
// polaska za partnera nije samo obavijest — to je stavka koja se skida s tog
// računa. Zato izvještaj uz popis karata donosi i obračun: cijena, provizija
// partnera i neto koji se odbija.
//
// Izvještaj je uvijek za JEDAN konkretan polazak: linija, datum i vrijeme stoje
// u zaglavlju, jer partner iste karte ima na više polazaka i bez toga ne zna na
// što se popis odnosi.

const ACCENT = "175BD0";
const BAND = "DCE6F7";
const HEADER_BG = "E8EDF5";
const BORDER = "C7D2E0";
const OTKAZ_BG = "FFE0B2";

const FMT_EUR = '#,##0.00" €"';

const thin = { style: "thin", color: { rgb: BORDER } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

const sTitle = { font: { bold: true, sz: 15, color: { rgb: "0F172A" } }, alignment: { vertical: "center" } };
const sPolazak = {
    font: { bold: true, sz: 12, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: BAND } },
    border: allBorders,
    alignment: { vertical: "center" },
};
const sMeta = { font: { sz: 10, color: { rgb: "64748B" } } };
const sHeader = {
    font: { bold: true, sz: 11, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: HEADER_BG } },
    border: allBorders,
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
};
const sCell = { font: { sz: 10 }, border: allBorders };
const sTotal = { font: { bold: true, sz: 11 }, border: { ...allBorders, top: { style: "medium", color: { rgb: ACCENT } } } };
const sNapomena = { font: { sz: 10, bold: true, color: { rgb: "E65100" } }, fill: { fgColor: { rgb: OTKAZ_BG } } };

const COLS = [
    { key: "sifra", label: "Šifra karte", w: 16 },
    { key: "putnik", label: "Putnik", w: 24 },
    { key: "vrsta", label: "Vrsta karte", w: 16 },
    { key: "relacija", label: "Relacija", w: 30 },
    { key: "narudzba", label: "Narudžba partnera", w: 24 },
    { key: "izdano", label: "Izdana", w: 16 },
    { key: "cijena", label: "Cijena (€)", w: 13, z: FMT_EUR },
    { key: "provizija", label: "Provizija (€)", w: 14, z: FMT_EUR },
    { key: "neto", label: "Za odbiti (€)", w: 14, z: FMT_EUR },
];

const IDX = Object.fromEntries(COLS.map((c, i) => [c.key, i]));
const N = COLS.length;
const PRVI_BROJCANI = IDX.cijena;

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmtDateTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
};

/**
 * @param {object} partner  { partner_name, partner_legal_id, partner_email, partner_contact_person, commission_pct }
 * @param {Array}  karte    otkazane karte tog partnera
 * @param {object} polazak  { linija, datum, vrijeme, relacija }  — obavezno, ide u zaglavlje
 */
export function buildPartnerWorkbook(partner, karte = [], polazak = {}) {
    const rows = [];
    const kinds = [];
    const blank = () => new Array(N).fill("");
    const push = (row, kind) => { rows.push(row); kinds.push(kind); };

    const provizijaPct = Number(partner?.commission_pct) || 0;
    const iznos = karte.reduce((z, k) => z + (Number(k.single_price) || 0), 0);
    const provizija = +(iznos * provizijaPct / 100).toFixed(2);
    const neto = +(iznos - provizija).toFixed(2);

    const r0 = blank();
    r0[0] = "Otkazane karte — izvještaj za partnera";
    push(r0, "title");

    // Polazak je istaknut: izvještaj vrijedi samo za njega.
    const r1 = blank();
    r1[0] = `Polazak: linija ${polazak.linija || "—"} · ${polazak.datum || "—"}`
        + (polazak.vrijeme ? ` u ${polazak.vrijeme}` : "")
        + (polazak.relacija ? ` · ${polazak.relacija}` : "");
    push(r1, "polazak");

    const r2 = blank();
    r2[0] = `Partner: ${partner?.partner_name || ""}`
        + (partner?.partner_legal_id ? ` · OIB ${partner.partner_legal_id}` : "")
        + (partner?.partner_contact_person ? ` · ${partner.partner_contact_person}` : "")
        + (partner?.partner_email ? ` · ${partner.partner_email}` : "");
    push(r2, "meta");

    const r3 = blank();
    r3[0] = `Otkazanih karata: ${karte.length} · Iznos: ${fmtEUR(iznos)}`
        + ` · Provizija ${provizijaPct}%: ${fmtEUR(provizija)} · Za odbiti sa zbirnog računa: ${fmtEUR(neto)}`;
    push(r3, "meta");

    const r4 = blank();
    r4[0] = "Polazak je otkazan — ove karte ne vrijede za ukrcaj.";
    push(r4, "napomena");
    push(blank(), "blank");

    push(COLS.map((c) => c.label), "header");

    for (const k of karte) {
        const cijena = Number(k.single_price) || 0;
        const prov = +(cijena * provizijaPct / 100).toFixed(2);
        const r = blank();
        r[IDX.sifra] = k.ticket_code || "";
        r[IDX.putnik] = k.passanger_name || "";
        r[IDX.vrsta] = k.ticket_type_name || "";
        r[IDX.relacija] = `${k.departure_harbor_name || ""} → ${k.arrival_harbor_name || ""}`;
        r[IDX.narudzba] = k.order_number || k.order_uuid || "";
        r[IDX.izdano] = fmtDateTime(k.issued_at);
        r[IDX.cijena] = cijena;
        r[IDX.provizija] = prov;
        r[IDX.neto] = +(cijena - prov).toFixed(2);
        push(r, "cell");
    }

    const rt = blank();
    rt[0] = "UKUPNO";
    rt[IDX.cijena] = +iznos.toFixed(2);
    rt[IDX.provizija] = provizija;
    rt[IDX.neto] = neto;
    push(rt, "total");

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const styleFor = {
        title: sTitle, polazak: sPolazak, meta: sMeta,
        napomena: sNapomena, header: sHeader, cell: sCell, total: sTotal,
    };

    for (let r = 0; r < rows.length; r++) {
        const kind = kinds[r];
        if (kind === "blank") continue;
        for (let c = 0; c < N; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) ws[addr] = { t: "s", v: "" };
            ws[addr].s = styleFor[kind];
            const z = COLS[c].z;
            if (z && ws[addr].t === "n") ws[addr].z = z;
            if (["cell", "total"].includes(kind) && c >= PRVI_BROJCANI) {
                ws[addr].s = { ...styleFor[kind], alignment: { horizontal: "right" } };
            }
        }
    }

    ws["!cols"] = COLS.map((c) => ({ wch: c.w }));
    ws["!rows"] = rows.map((_, r) => (
        kinds[r] === "title" ? { hpt: 22 } : kinds[r] === "polazak" ? { hpt: 20 } : kinds[r] === "header" ? { hpt: 26 } : {}
    ));
    ws["!merges"] = [0, 1, 2, 3, 4].map((r) => ({ s: { r, c: 0 }, e: { r, c: N - 1 } }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Otkazane karte");
    return wb;
}

export function partnerFileName(partner, polazak = {}) {
    const ocisti = (v, duljina) => String(v || "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
        .slice(0, duljina);
    const ime = ocisti(partner?.partner_acr || partner?.partner_name || "partner", 24) || "partner";
    const dan = String(polazak.datum || "").replace(/\D/g, "");
    const sat = String(polazak.vrijeme || "").replace(/\D/g, "");
    return `otkazane-${ime}-${polazak.linija || ""}-${dan}${sat ? "-" + sat : ""}.xlsx`;
}
