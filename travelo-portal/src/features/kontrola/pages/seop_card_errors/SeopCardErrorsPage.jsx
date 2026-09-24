import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, Divider, Paper, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";

import { kontrolaSliceData, fetchSeopCardErrorsThunk } from "../../kontrolaSlice";
import { setAuthData } from "../../../auth/authSlice";

// Čitljivi nazivi i boje razloga. Nepoznat razlog se prikaže sirov, da se nova
// vrijednost s uređaja ne izgubi ako sučelje zaostane za njim.
const RAZLOZI = {
    nemoguce_ocitati: { label: "Nemoguće očitati karticu", color: "warning" },
    kartica_ostecena: { label: "Kartica oštećena", color: "error" },
    greska_oprema: { label: "Greška na opremi", color: "error" },
    prekid_komunikacije: { label: "Prekid u komunikaciji", color: "info" },
};
const razlogInfo = (r) => RAZLOZI[r] || { label: r || "—", color: "default" };

// Odakle popust na karti. Na ovoj stranici je gotovo uvijek „povjerenje" —
// pravo se nije provjerilo, pa je postotak operaterova odluka — ali karta zna i
// druge izvore, pa se ne pretpostavlja.
const IZVOR = {
    povjerenje: "odluka operatera",
    lokalni_katalog: "lokalni šifarnik",
    seop: "SEOP",
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

export default function SeopCardErrorsPage() {
    const dispatch = useDispatch();
    const data = useSelector(kontrolaSliceData);

    const [from, setFrom] = useState(danaUnazad(30));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [sifra, setSifra] = useState("");
    // Prazan razlog je kartica "Sve".
    const [razlog, setRazlog] = useState("");

    const ucitaj = (zaRazlog = razlog) => {
        dispatch(fetchSeopCardErrorsThunk({ from, to, ...(zaRazlog ? { razlog: zaRazlog } : {}) }));
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        ucitaj("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const promijeniKarticu = (_e, novi) => {
        setRazlog(novi);
        ucitaj(novi);
    };

    // Šifra karte / broj iskaznice filtrira prikazani popis (u memoriji).
    const sviRedci = data.seopCardErrors || [];
    const redci = sifra
        ? sviRedci.filter((r) =>
            String(r.ticket_code || "").toUpperCase().includes(sifra) ||
            String(r.card_no || "").toUpperCase().includes(sifra))
        : sviRedci;

    const brojaci = data.seopCardCounts || {};
    const ukupno = Object.values(brojaci).reduce((z, n) => z + n, 0);
    // Kartice se slažu iz poznatih razloga + svega što je stiglo, da nepoznat
    // razlog ne ostane bez svoje kartice.
    const razlozi = [...new Set([...Object.keys(RAZLOZI), ...Object.keys(brojaci)])];

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
    }, [razlog, redci.length]);

    const columns = [
        {
            field: "izdano",
            headerName: "Datum",
            width: 170,
            valueGetter: (_v, r) => r.izdano_u || r.createdAt,
            valueFormatter: (v) => fmtVrijeme(v),
        },
        {
            field: "linija",
            headerName: "Linija",
            width: 170,
            valueGetter: (_v, r) => (r.line_code
                ? `${r.line_code}${r.line_name ? " · " + r.line_name : ""}`
                : "—"),
        },
        {
            field: "relacija",
            headerName: "Relacija",
            width: 200,
            valueGetter: (_v, r) => (r.departure_harbor_name
                ? `${r.departure_harbor_name} → ${r.arrival_harbor_name || ""}`
                : "—"),
        },
        {
            field: "iskaznica",
            headerName: "Iskaznica",
            width: 170,
            valueGetter: (_v, r) => (r.card_no
                ? `${r.card_no}${r.id_type ? " (" + r.id_type + ")" : ""}`
                : "—"),
        },
        {
            field: "razlog",
            headerName: "Razlog",
            width: 220,
            renderCell: (p) => {
                const i = razlogInfo(p.value);
                return <Chip size="small" color={i.color} label={i.label} />;
            },
        },
        {
            // Razlog govori zasto pravo nije provjereno; ovo govori koliko je
            // operater na to dao. Bez oba podatka kontrola nema sto usporediti.
            field: "popust_postotak",
            headerName: "Popust",
            width: 170,
            sortable: true,
            renderCell: (p) => {
                const pct = Number(p.value);
                if (!(pct > 0)) return <Typography variant="body2" color="text.secondary">puna cijena</Typography>;
                const izvor = IZVOR[p.row.popust_izvor] || p.row.popust_izvor;
                return (
                    <Stack spacing={0} sx={{ lineHeight: 1.2 }}>
                        <Typography variant="body2" fontWeight={800}>{pct} %</Typography>
                        {izvor ? (
                            <Typography variant="caption" color="text.secondary">{izvor}</Typography>
                        ) : null}
                    </Stack>
                );
            },
        },
        {
            field: "naplaceno",
            headerName: "Naplaćeno",
            width: 150,
            sortable: true,
            renderCell: (p) => {
                if (p.value === null || p.value === undefined) {
                    return <Typography variant="body2" color="text.secondary">—</Typography>;
                }
                const redovna = Number(p.row.redovna_cijena);
                const iznos = Number(p.value);
                return (
                    <Stack spacing={0} sx={{ lineHeight: 1.2 }}>
                        <Typography variant="body2" fontWeight={800}>{fmtEur(iznos)}</Typography>
                        {redovna > iznos ? (
                            <Typography variant="caption" color="text.secondary">
                                redovna {fmtEur(redovna)}
                            </Typography>
                        ) : null}
                    </Stack>
                );
            },
        },
        { field: "napomena", headerName: "Napomena", width: 280, renderCell: (p) => p.value || "—" },
        {
            // Uredaj se pokazuje brojem ili nazivom; uuid ovdje nikome nista ne
            // znaci, a zapisi ga od sada nose uz sebe.
            field: "uredaj",
            headerName: "Uređaj",
            width: 150,
            valueGetter: (_v, r) => r.terminal_tid || r.terminal_name || "—",
        },
        { field: "operator", headerName: "Operater", width: 160, renderCell: (p) => p.value || "—" },
        { field: "ticket_code", headerName: "Broj karte", width: 150, renderCell: (p) => p.value || "—" },
    ];

    return (
        <Box sx={{ width: "100%", maxWidth: 1600 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" fontWeight={800} sx={{ mr: 2 }}>
                        Greške s povlaštenim karticama
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
                        label="Karta / iskaznica"
                        value={sifra}
                        onChange={(e) => setSifra(e.target.value.toUpperCase())}
                        sx={{ width: 220 }}
                        helperText="filtrira prikazani popis"
                    />
                    <Box sx={{ flex: 1 }} />
                    <Chip label={`${redci.length} zapisa`} />
                    <Button onClick={() => setSifra("")} disabled={!sifra}>Očisti</Button>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={() => ucitaj()}
                        disabled={data.seopCardErrorsLoading}
                    >
                        Pretraži
                    </Button>
                </Stack>
            </Paper>

            {data.seopCardErrorsError && (
                <Alert severity="error" sx={{ mb: 2 }}>{data.seopCardErrorsError}</Alert>
            )}

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
                <Tabs value={razlog} onChange={promijeniKarticu} variant="scrollable" scrollButtons="auto">
                    <Tab value="" label={`Sve (${ukupno})`} />
                    {razlozi.map((r) => (
                        <Tab key={r} value={r} label={`${razlogInfo(r).label} (${brojaci[r] || 0})`} />
                    ))}
                </Tabs>
            </Box>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Box ref={tablicaRef} sx={{ height: visinaTablice, minWidth: 1100 }}>
                <DataGrid
                    rows={redci}
                    getRowId={(r) => r.uuid || r.id || `${r.ticket_uuid}|${r.createdAt}`}
                    columns={columns}
                    loading={data.seopCardErrorsLoading}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 50, page: 0 } },
                        sorting: { sortModel: [{ field: "izdano", sort: "desc" }] },
                    }}
                    pageSizeOptions={[25, 50, 100, 250]}
                    disableRowSelectionOnClick
                    localeText={{ noRowsLabel: "Nema zabilježenih grešaka s karticama." }}
                />
            </Box>
            </Box>
        </Box>
    );
}
