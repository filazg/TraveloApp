import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
    Paper, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";

import { kontrolaSliceData, fetchF2ErrorsThunk } from "../../kontrolaSlice";
import { setAuthData } from "../../../auth/authSlice";

// Gdje je F2 pao. Nepoznata vrijednost se prikaže sirova, da nova faza s
// poslužitelja ne nestane ako sučelje zaostane.
const FAZE = {
    slanje: { label: "Slanje", color: "error" },
    fiskalizacija: { label: "Fiskalizacija", color: "warning" },
};
const fazaInfo = (f) => FAZE[f] || { label: f || "—", color: "default" };

// Tok iz kojeg je račun poslan.
const IZVORI = {
    blagajna: "blagajna",
    sinkronizacija: "sinkronizacija uređaja",
    web: "web prodaja",
    partnerski: "partnerski račun",
    status: "provjera statusa",
};

const fmtEur = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toFixed(2)} €`);

const fmtVrijeme = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("hr-HR");
};

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function F2ErrorsPage() {
    const dispatch = useDispatch();
    const data = useSelector(kontrolaSliceData);

    const [from, setFrom] = useState(danaUnazad(30));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [trazi, setTrazi] = useState("");
    // Prazna faza je kartica "Sve".
    const [faza, setFaza] = useState("");
    const [odabran, setOdabran] = useState(null);

    const ucitaj = (zaFazu = faza) => {
        dispatch(fetchF2ErrorsThunk({ from, to, ...(zaFazu ? { faza: zaFazu } : {}) }));
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        ucitaj("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const promijeniKarticu = (_e, nova) => {
        setFaza(nova);
        ucitaj(nova);
    };

    // Broj računa / kupac / OIB filtrira prikazani popis (u memoriji).
    const sviRedci = data.f2Errors || [];
    const redci = trazi
        ? sviRedci.filter((r) =>
            [r.invoice_code, r.invoice_no, r.kupac_naziv, r.kupac_oib]
                .some((v) => String(v || "").toUpperCase().includes(trazi)))
        : sviRedci;

    const brojaci = data.f2ErrorsCounts || {};
    const ukupno = Object.values(brojaci).reduce((z, n) => z + n, 0);
    const faze = [...new Set([...Object.keys(FAZE), ...Object.keys(brojaci)])];

    const tablicaRef = useRef(null);
    const [visinaTablice, setVisinaTablice] = useState(520);
    useLayoutEffect(() => {
        const preracunaj = () => {
            const vrh = tablicaRef.current?.getBoundingClientRect().top ?? 0;
            setVisinaTablice(Math.max(320, window.innerHeight - vrh - 24));
        };
        preracunaj();
        window.addEventListener("resize", preracunaj);
        return () => window.removeEventListener("resize", preracunaj);
    }, [faza, redci.length]);

    const columns = [
        {
            field: "createdAt",
            headerName: "Vrijeme greške",
            width: 170,
            valueFormatter: (v) => fmtVrijeme(v),
        },
        {
            field: "faza",
            headerName: "Faza",
            width: 130,
            renderCell: (p) => {
                const i = fazaInfo(p.value);
                return <Chip size="small" color={i.color} label={i.label} />;
            },
        },
        {
            field: "racun",
            headerName: "Račun",
            width: 150,
            valueGetter: (_v, r) => r.invoice_code || r.invoice_no || "—",
        },
        {
            field: "invoice_date",
            headerName: "Datum računa",
            width: 170,
            valueFormatter: (v) => fmtVrijeme(v),
        },
        {
            field: "kupac",
            headerName: "Kupac",
            width: 240,
            valueGetter: (_v, r) => r.kupac_naziv || "—",
            renderCell: (p) => (
                <Stack spacing={0} sx={{ lineHeight: 1.2, py: 0.5 }}>
                    <Typography variant="body2" noWrap>{p.value}</Typography>
                    {p.row.kupac_oib ? (
                        <Typography variant="caption" color="text.secondary">OIB {p.row.kupac_oib}</Typography>
                    ) : null}
                </Stack>
            ),
        },
        { field: "iznos", headerName: "Iznos", width: 110, valueFormatter: (v) => fmtEur(v) },
        {
            // Prvi redak poruke je dovoljan za pregled; cijela je u detalju.
            field: "poruka",
            headerName: "Greška",
            flex: 1,
            minWidth: 360,
            renderCell: (p) => (
                <Typography variant="body2" noWrap title={p.value || ""}>
                    {String(p.value || "—").split("\n").slice(-1)[0]}
                </Typography>
            ),
        },
        { field: "http_status", headerName: "HTTP", width: 80, renderCell: (p) => p.value || "—" },
        {
            field: "izvor",
            headerName: "Izvor",
            width: 170,
            valueGetter: (_v, r) => IZVORI[r.izvor] || r.izvor || "—",
        },
        {
            field: "uredaj",
            headerName: "Uređaj",
            width: 140,
            valueGetter: (_v, r) => r.terminal_tid || r.terminal_name || "—",
        },
        { field: "operator", headerName: "Operater", width: 160, renderCell: (p) => p.value || "—" },
    ];

    return (
        <Box sx={{ width: "100%", maxWidth: 1600 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" fontWeight={800} sx={{ mr: 2 }}>
                        F2 greške
                    </Typography>
                    <TextField
                        size="small" type="date" label="Od" InputLabelProps={{ shrink: true }}
                        value={from} onChange={(e) => setFrom(e.target.value)}
                    />
                    <TextField
                        size="small" type="date" label="Do" InputLabelProps={{ shrink: true }}
                        value={to} onChange={(e) => setTo(e.target.value)}
                    />
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                        size="small"
                        label="Račun / kupac / OIB"
                        value={trazi}
                        onChange={(e) => setTrazi(e.target.value.toUpperCase())}
                        sx={{ width: 240 }}
                        helperText="filtrira prikazani popis"
                    />
                    <Box sx={{ flex: 1 }} />
                    <Chip label={`${redci.length} zapisa`} />
                    <Button onClick={() => setTrazi("")} disabled={!trazi}>Očisti</Button>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={() => ucitaj()}
                        disabled={data.f2ErrorsLoading}
                    >
                        Pretraži
                    </Button>
                </Stack>
            </Paper>

            {data.f2ErrorsError && (
                <Alert severity="error" sx={{ mb: 2 }}>{data.f2ErrorsError}</Alert>
            )}

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
                <Tabs value={faza} onChange={promijeniKarticu} variant="scrollable" scrollButtons="auto">
                    <Tab value="" label={`Sve (${ukupno})`} />
                    {faze.map((f) => (
                        <Tab key={f} value={f} label={`${fazaInfo(f).label} (${brojaci[f] || 0})`} />
                    ))}
                </Tabs>
            </Box>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Box ref={tablicaRef} sx={{ height: visinaTablice, minWidth: 1200 }}>
                <DataGrid
                    rows={redci}
                    getRowId={(r) => r.uuid || r.id}
                    columns={columns}
                    loading={data.f2ErrorsLoading}
                    onRowClick={(p) => setOdabran(p.row)}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 50, page: 0 } },
                        sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
                    }}
                    pageSizeOptions={[25, 50, 100, 250]}
                    disableRowSelectionOnClick
                    sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
                    localeText={{ noRowsLabel: "Nema zabilježenih F2 grešaka." }}
                />
            </Box>
            </Box>

            <Dialog open={!!odabran} onClose={() => setOdabran(null)} maxWidth="md" fullWidth>
                <DialogTitle>
                    F2 greška — račun {odabran?.invoice_code || odabran?.invoice_no || "—"}
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={0.5} sx={{ mb: 2 }}>
                        <Typography variant="body2">Vrijeme: {fmtVrijeme(odabran?.createdAt)}</Typography>
                        <Typography variant="body2">
                            Faza: {fazaInfo(odabran?.faza).label} · izvor: {IZVORI[odabran?.izvor] || odabran?.izvor || "—"}
                            {odabran?.http_status ? ` · HTTP ${odabran.http_status}` : ""}
                        </Typography>
                        <Typography variant="body2">
                            Kupac: {odabran?.kupac_naziv || "—"}{odabran?.kupac_oib ? ` (OIB ${odabran.kupac_oib})` : ""}
                        </Typography>
                        {odabran?.yescor_document_id ? (
                            <Typography variant="body2">YesCor dokument: {odabran.yescor_document_id}</Typography>
                        ) : null}
                    </Stack>
                    <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                            whiteSpace: "pre-wrap", wordBreak: "break-word", m: 0, p: 1.5,
                            bgcolor: "rgba(179,38,30,0.06)", borderRadius: 1, fontFamily: "monospace",
                        }}
                    >
                        {odabran?.poruka || "—"}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOdabran(null)}>Zatvori</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
