import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, Divider, Paper, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";

import { kontrolaSliceData, fetchSeopOfflineSalesThunk } from "../../kontrolaSlice";
import { setAuthData } from "../../../auth/authSlice";

// Povlaštene karte prodane dok SEOP nije bio dostupan.
//
// Zapis je sama karta (`seop_offline`), pa ovdje nema ničega što bi se moglo
// razići s prodajom. Tri vrste se razlikuju po tome što je uređaj znao u
// trenutku prodaje — a to je jedino što kontrolu zanima: je li popust dodijeljen
// po pravu s čipa ili je karta izdana na povjerenje.
const VRSTE = {
    popust: {
        label: "Popust po pravu",
        color: "success",
        opis: "Čip je pročitan, pravo poznato, postotak iz lokalnog šifarnika.",
    },
    bez_prava: {
        label: "Bez potvrđenog prava",
        color: "warning",
        opis: "Izdana na povjerenje uz razlog — popust se nije mogao odrediti.",
    },
    ostalo: {
        label: "Ostalo",
        color: "default",
        opis: "Offline karta koja ne ulazi ni u jedno od prethodnog.",
    },
};
const vrstaInfo = (v) => VRSTE[v] || { label: v || "—", color: "default" };

const IZVOR = {
    lokalni_katalog: "lokalni šifarnik",
    seop: "SEOP",
};

const fmtVrijeme = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("hr-HR");
};

const fmtEur = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toFixed(2)} €`);

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function SeopOfflineSalesPage() {
    const dispatch = useDispatch();
    const data = useSelector(kontrolaSliceData);

    const [from, setFrom] = useState(danaUnazad(30));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [sifra, setSifra] = useState("");
    // Prazna vrsta je kartica "Sve".
    const [vrsta, setVrsta] = useState("");

    const ucitaj = (zaVrstu = vrsta) => {
        dispatch(fetchSeopOfflineSalesThunk({ from, to, ...(zaVrstu ? { vrsta: zaVrstu } : {}) }));
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        ucitaj("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const promijeniKarticu = (_e, novi) => {
        setVrsta(novi);
        ucitaj(novi);
    };

    // Šifra karte / broj iskaznice filtrira prikazani popis (u memoriji).
    const sviRedci = data.seopOfflineSales || [];
    const redci = sifra
        ? sviRedci.filter((r) =>
            String(r.ticket_code || "").toUpperCase().includes(sifra) ||
            String(r.seop_card_no || "").toUpperCase().includes(sifra))
        : sviRedci;

    const brojaci = data.seopOfflineCounts || {};
    const ukupno = Object.values(brojaci).reduce((z, n) => z + n, 0);
    const vrste = [...new Set([...Object.keys(VRSTE), ...Object.keys(brojaci)])];

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
    }, [vrsta, redci.length]);

    const columns = [
        {
            field: "prodano",
            headerName: "Datum",
            width: 170,
            valueGetter: (_v, r) => r.createdAt,
            valueFormatter: (v) => fmtVrijeme(v),
        },
        {
            field: "vrsta",
            headerName: "Vrsta",
            width: 200,
            renderCell: (p) => {
                const i = vrstaInfo(p.value);
                return <Chip size="small" color={i.color} label={i.label} />;
            },
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
            width: 160,
            valueGetter: (_v, r) => (r.seop_card_no
                ? `${r.seop_card_no}${r.seop_id_vrsta ? " (" + r.seop_id_vrsta + ")" : ""}`
                : "—"),
        },
        { field: "seop_pravo", headerName: "Pravo", width: 100, renderCell: (p) => p.value || "—" },
        { field: "seop_otok", headerName: "Otok", width: 140, renderCell: (p) => p.value || "—" },
        {
            field: "popust",
            headerName: "Popust",
            width: 170,
            valueGetter: (_v, r) => (Number(r.seop_discount_pct) > 0
                ? `${r.seop_discount_pct}% (${IZVOR[r.seop_popust_izvor] || "nepoznato"})`
                : "—"),
        },
        {
            field: "cijena",
            headerName: "Naplaćeno",
            width: 120,
            valueGetter: (_v, r) => r.single_price ?? r.total_price,
            valueFormatter: (v) => fmtEur(v),
        },
        {
            field: "seop_redovna_cijena",
            headerName: "Redovna",
            width: 110,
            valueFormatter: (v) => fmtEur(v),
        },
        { field: "ticket_code", headerName: "Broj karte", width: 150, renderCell: (p) => p.value || "—" },
    ];

    return (
        <Box sx={{ width: "100%", maxWidth: 1600 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" fontWeight={800} sx={{ mr: 2 }}>
                        Offline prodaja povlaštenih karata
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

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Karte prodane dok SEOP nije bio dostupan. Provjere prava u SEOP-u nije bilo —
                    popust je, kad ga ima, dodijeljen po pravu s čipa i postotku iz šifarnika
                    (Integracije → AKD → SEOP → Popusti).
                </Typography>

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
                    <Chip label={`${redci.length} karata`} />
                    <Button onClick={() => setSifra("")} disabled={!sifra}>Očisti</Button>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={() => ucitaj()}
                        disabled={data.seopOfflineLoading}
                    >
                        Pretraži
                    </Button>
                </Stack>
            </Paper>

            {data.seopOfflineError && (
                <Alert severity="error" sx={{ mb: 2 }}>{data.seopOfflineError}</Alert>
            )}

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
                <Tabs value={vrsta} onChange={promijeniKarticu} variant="scrollable" scrollButtons="auto">
                    <Tab value="" label={`Sve (${ukupno})`} />
                    {vrste.map((v) => (
                        <Tab key={v} value={v} label={`${vrstaInfo(v).label} (${brojaci[v] || 0})`} />
                    ))}
                </Tabs>
            </Box>

            {vrsta && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {vrstaInfo(vrsta).opis}
                </Typography>
            )}

            <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Box ref={tablicaRef} sx={{ height: visinaTablice, minWidth: 1100 }}>
                <DataGrid
                    rows={redci}
                    getRowId={(r) => r.ticket_uuid || r.id || `${r.ticket_code}|${r.createdAt}`}
                    columns={columns}
                    loading={data.seopOfflineLoading}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 50, page: 0 } },
                        sorting: { sortModel: [{ field: "prodano", sort: "desc" }] },
                    }}
                    pageSizeOptions={[25, 50, 100, 250]}
                    disableRowSelectionOnClick
                    localeText={{ noRowsLabel: "Nema karata prodanih bez veze sa SEOP-om." }}
                />
            </Box>
            </Box>
        </Box>
    );
}
