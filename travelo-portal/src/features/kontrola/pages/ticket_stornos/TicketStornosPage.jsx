import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, Divider, Paper, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";

import { kontrolaSliceData, fetchTicketStornosThunk } from "../../kontrolaSlice";
import { setAuthData } from "../../../auth/authSlice";

// Storna karata — i pojedinačno stornirane karte i karte stornirane sa svojim
// računom. Svaki redak je jedna karta.
//
// Rok za storno na uređajima je 30 min nakon polaska (osim uz „Slobodno
// storniranje"), pa se storna razvrstavaju po tome kad su napravljena u odnosu
// na polazak. Odbijeni pokušaj storna validirane karte nije storno — novac nije
// vraćen — pa se vidi samo u „Sve" i „Validirane".
const KARTICE = {
    prije_polaska: {
        label: "Prije polaska",
        color: "success",
        opis: "Storno napravljen prije polaska broda.",
    },
    u_roku: {
        label: "Unutar 30 min od polaska",
        color: "warning",
        opis: "Brod je već isplovio, ali storno je napravljen unutar dopuštenih 30 min.",
    },
    nakon_roka: {
        label: "Nakon roka",
        color: "error",
        opis: "Storno napravljen više od 30 min nakon polaska — moguće samo uz uključeno „Slobodno storniranje\" ili sa starijeg uređaja.",
    },
    validirane: {
        label: "Validirane",
        color: "error",
        opis: "Karte validirane na ukrcaju (očitanjem): odbijeni pokušaji storna i storna koja su ipak prošla (npr. prije ove provjere ili iz portala).",
    },
};

const IZVOR = {
    desk: "Blagajna",
    mobile: "Mobilna",
    portal: "Portal",
    druga_blagajna: "Blagajna (tuđa karta)",
};

const fmtVrijeme = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("hr-HR");
};

const fmtEur = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toFixed(2)} €`);

// Minute od polaska u čitljivom obliku: "+1 h 25 min", "−40 min".
const fmtOdPolaska = (m) => {
    if (m === null || m === undefined) return "—";
    const znak = m < 0 ? "−" : "+";
    const a = Math.abs(m);
    const h = Math.floor(a / 60);
    const min = a % 60;
    return `${znak}${h ? `${h} h ` : ""}${min} min`;
};

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function TicketStornosPage() {
    const dispatch = useDispatch();
    const data = useSelector(kontrolaSliceData);

    const [from, setFrom] = useState(danaUnazad(30));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [trazi, setTrazi] = useState("");
    // Prazna kartica je „Sve".
    const [kartica, setKartica] = useState("");

    const ucitaj = (zaKarticu = kartica) => {
        dispatch(fetchTicketStornosThunk({ from, to, ...(zaKarticu ? { kategorija: zaKarticu } : {}) }));
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        ucitaj("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const promijeniKarticu = (_e, nova) => {
        setKartica(nova);
        ucitaj(nova);
    };

    // Karta / storno račun / operater filtrira prikazani popis (u memoriji).
    const sviRedci = data.ticketStornos || [];
    const redci = trazi
        ? sviRedci.filter((r) =>
            [r.ticket_code, r.storno_invoice_code, r.operator, r.terminal_name, r.terminal_tid]
                .some((v) => String(v || "").toUpperCase().includes(trazi)))
        : sviRedci;

    const brojaci = data.ticketStornosCounts || {};

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
    }, [kartica, redci.length]);

    const columns = [
        {
            field: "storno_at",
            headerName: "Storno",
            width: 165,
            valueFormatter: (v) => fmtVrijeme(v),
        },
        {
            field: "ishod",
            headerName: "Ishod",
            width: 190,
            valueGetter: (_v, r) => r.outcome,
            renderCell: (p) => {
                const r = p.row;
                if (r.outcome === "odbijeno_validirana") {
                    return <Chip size="small" color="error" variant="outlined" label="Odbijen — validirana" />;
                }
                const k = KARTICE[r.kategorija];
                return <Chip size="small" color={k?.color || "default"} label={k?.label || "Nepoznat polazak"} />;
            },
        },
        {
            field: "polazak",
            headerName: "Polazak",
            width: 150,
            renderCell: (p) => p.value || p.row.departure_planed || "—",
        },
        {
            field: "minutes_after_departure",
            headerName: "Od polaska",
            width: 115,
            renderCell: (p) => (
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: p.row.kategorija === "nakon_roka" ? 800 : 400,
                        color: p.row.kategorija === "nakon_roka" ? "error.main" : "inherit",
                    }}
                >
                    {fmtOdPolaska(p.value)}
                </Typography>
            ),
        },
        {
            field: "validated_at",
            headerName: "Validirana",
            width: 165,
            renderCell: (p) => (p.value
                ? <Typography variant="body2" color="error.main" fontWeight={700}>{fmtVrijeme(p.value)}</Typography>
                : "—"),
        },
        { field: "ticket_code", headerName: "Karta", width: 140, renderCell: (p) => p.value || "—" },
        { field: "ticket_type_name", headerName: "Vrsta karte", width: 150, renderCell: (p) => p.value || "—" },
        {
            field: "relacija",
            headerName: "Relacija",
            width: 200,
            valueGetter: (_v, r) => (r.departure_harbor_name
                ? `${r.departure_harbor_name} → ${r.arrival_harbor_name || ""}`
                : "—"),
        },
        { field: "ticket_price", headerName: "Cijena", width: 95, valueFormatter: (v) => fmtEur(v) },
        {
            field: "percentage",
            headerName: "Povrat",
            width: 130,
            valueGetter: (_v, r) => r.refund_amount,
            renderCell: (p) => (p.row.outcome === "storno"
                ? `${fmtEur(p.row.refund_amount)}${p.row.percentage != null ? ` (${Number(p.row.percentage)} %)` : ""}`
                : "—"),
        },
        { field: "storno_invoice_code", headerName: "Storno račun", width: 150, renderCell: (p) => p.value || "—" },
        { field: "operator", headerName: "Operater", width: 150, renderCell: (p) => p.value || "—" },
        {
            field: "uredaj",
            headerName: "Uređaj",
            width: 170,
            valueGetter: (_v, r) => (r.terminal_tid
                ? `${r.terminal_tid}${r.terminal_name ? " · " + r.terminal_name : ""}`
                : (r.terminal_name || IZVOR[r.source] || "—")),
        },
        { field: "source", headerName: "Izvor", width: 120, valueFormatter: (v) => IZVOR[v] || v || "—" },
        {
            field: "slobodno_storniranje",
            headerName: "Slobodno st.",
            width: 110,
            valueFormatter: (v) => (v === true ? "uključeno" : v === false ? "—" : ""),
        },
    ];

    return (
        <Box sx={{ width: "100%", maxWidth: 1800 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" fontWeight={800} sx={{ mr: 2 }}>
                        Storniranje karata
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
                    Svako storno karte — pojedinačno ili s računom — i svaki odbijeni pokušaj storna
                    validirane karte. Vrijeme od polaska mjeri se od polaska po kojem je uređaj računao
                    rok (kod pomaknutog polaska to je novo vrijeme).
                </Typography>

                <Divider sx={{ my: 1 }} />

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                        size="small"
                        label="Karta / račun / operater / uređaj"
                        value={trazi}
                        onChange={(e) => setTrazi(e.target.value.toUpperCase())}
                        sx={{ width: 280 }}
                        helperText="filtrira prikazani popis"
                    />
                    <Box sx={{ flex: 1 }} />
                    <Chip label={`${redci.length} zapisa`} />
                    <Button onClick={() => setTrazi("")} disabled={!trazi}>Očisti</Button>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={() => ucitaj()}
                        disabled={data.ticketStornosLoading}
                    >
                        Pretraži
                    </Button>
                </Stack>
            </Paper>

            {data.ticketStornosError && (
                <Alert severity="error" sx={{ mb: 2 }}>{data.ticketStornosError}</Alert>
            )}

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
                <Tabs value={kartica} onChange={promijeniKarticu} variant="scrollable" scrollButtons="auto">
                    <Tab value="" label={`Sve (${brojaci.sve || 0})`} />
                    {Object.entries(KARTICE).map(([k, v]) => (
                        <Tab key={k} value={k} label={`${v.label} (${brojaci[k] || 0})`} />
                    ))}
                </Tabs>
            </Box>

            {kartica && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {KARTICE[kartica]?.opis}
                </Typography>
            )}

            <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Box ref={tablicaRef} sx={{ height: visinaTablice, minWidth: 1400 }}>
                <DataGrid
                    rows={redci}
                    getRowId={(r) => r.uuid || r.id}
                    columns={columns}
                    loading={data.ticketStornosLoading}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 50, page: 0 } },
                        sorting: { sortModel: [{ field: "storno_at", sort: "desc" }] },
                    }}
                    pageSizeOptions={[25, 50, 100, 250]}
                    disableRowSelectionOnClick
                    localeText={{ noRowsLabel: "Nema storna u odabranom razdoblju." }}
                />
            </Box>
            </Box>
        </Box>
    );
}
