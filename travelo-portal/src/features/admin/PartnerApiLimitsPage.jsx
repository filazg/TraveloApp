import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import { authSliceData, setAuthData } from "../auth/authSlice";

// Adrese koje su prešle dopuštene okvire pozivanja API-ja partnera.
//
// Granice su iste kao u API-ju, po minuti: prijava 10 po adresi, pozivi bez
// prijave 30 po adresi, ukupno 120. Adresa je ovdje ako je dobila odbijenicu
// „previše zahtjeva" (429) ili je u nekoj minuti poslala više od dopuštenog —
// zahtjevi bez tokena do limita partnera nikad ne dođu, pa bi se skener koji
// pretražuje bez prijave inače ne bi vidio.
const ADMIN_USER = "nfilipec";

const formatDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR");
};

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function PartnerApiLimitsPage() {
    const dispatch = useDispatch();
    const authData = useSelector(authSliceData);
    const username = authData?.loggedUserData?.username;

    useEffect(() => { dispatch(setAuthData({ path: "loading", value: false })); }, [dispatch]);

    const [adrese, setAdrese] = useState([]);
    const [granice, setGranice] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [from, setFrom] = useState(danaUnazad(30));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
        timeout: 30000,
    }), [authData.backendURL]);

    const load = useCallback(async (filtri) => {
        setLoading(true);
        setError("");
        try {
            const r = await api.post("/portal/admin/partner_api_limits", filtri);
            const d = r?.data?.data ?? r?.data ?? {};
            setAdrese(d.adrese || []);
            setGranice(d.granice || {});
        } catch (e) {
            setError(e?.response?.data?.data?.message || e?.response?.data?.message || e.message || "Dohvat nije uspio.");
            setAdrese([]);
        }
        setLoading(false);
    }, [api]);

    const trazi = useCallback(() => load({ from, to }), [load, from, to]);

    useEffect(() => {
        if (username !== ADMIN_USER) return;
        load({ from: danaUnazad(30), to: new Date().toISOString().slice(0, 10) });
    }, [username, load]);

    const columns = useMemo(() => [
        { field: "ip_address", headerName: "Adresa (IP)", width: 150 },
        {
            field: "tko", headerName: "Tko", width: 220,
            renderCell: (p) => {
                const r = p.row;
                return (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ overflow: "hidden" }}>
                        {r.ima_anonimnih && <Chip size="small" color="warning" label="SKENER" />}
                        {r.partneri && <Typography variant="body2" noWrap>{r.partneri}</Typography>}
                    </Stack>
                );
            },
        },
        {
            field: "minuta_preko", headerName: "Minuta preko", width: 115,
            renderCell: (p) => <Typography variant="body2" fontWeight={800} color="error.main">{p.value}</Typography>,
        },
        { field: "odbijeno_429", headerName: "Odbijeno (429)", width: 120 },
        { field: "vrh_u_minuti", headerName: "Vrh/min", width: 85 },
        { field: "vrh_prijava", headerName: "Prijava/min", width: 100 },
        { field: "vrh_anonimno", headerName: "Bez prijave/min", width: 125 },
        { field: "zahtjeva", headerName: "Ukupno", width: 85 },
        { field: "prvi_put", headerName: "Prvi put", width: 160, valueFormatter: (v) => formatDate(v) },
        { field: "zadnji_put", headerName: "Zadnji put", width: 160, valueFormatter: (v) => formatDate(v) },
        { field: "pozivi", headerName: "Pozivi", flex: 1, minWidth: 220 },
        { field: "user_agent", headerName: "Klijent", width: 260 },
    ], []);

    if (username !== ADMIN_USER) {
        return <Box sx={{ p: 2 }}><Alert severity="error">Pristup je ograničen.</Alert></Box>;
    }

    return (
        <Box sx={{ p: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>API partneri — prekoračenja limita</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Adrese koje su prešle dopušteno pozivanje API-ja: prijava {granice.prijava ?? 10}/min,
                        bez prijave {granice.anonimno ?? 30}/min, ukupno {granice.ukupno ?? 120}/min — ili su
                        dobile odbijenicu „previše zahtjeva" (429).
                    </Typography>
                </Box>
                <Button startIcon={<RefreshIcon />} onClick={trazi} disabled={loading}>Osvježi</Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center">
                <TextField size="small" type="date" label="Od" InputLabelProps={{ shrink: true }}
                    value={from} onChange={(e) => setFrom(e.target.value)} />
                <TextField size="small" type="date" label="Do" InputLabelProps={{ shrink: true }}
                    value={to} onChange={(e) => setTo(e.target.value)} />
                <Button variant="contained" startIcon={<SearchIcon />} onClick={trazi} disabled={loading}>Traži</Button>
                <Chip label={`${adrese.length} adresa`} />
            </Stack>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ height: "68vh", minWidth: 1400 }}>
                    <DataGrid
                        rows={adrese}
                        columns={columns}
                        getRowId={(r) => r.ip_address}
                        loading={loading}
                        disableRowSelectionOnClick
                        initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
                        pageSizeOptions={[25, 50, 100]}
                        localeText={{ noRowsLabel: "Nijedna adresa nije prešla dopušteno pozivanje u tom rasponu." }}
                    />
                </Box>
            </Box>
        </Box>
    );
}
