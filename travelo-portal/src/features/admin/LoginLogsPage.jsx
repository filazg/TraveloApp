import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
    Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, Stack, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import { authSliceData, setAuthData } from "../auth/authSlice";

const ADMIN_USER = "nfilipec";

const formatDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR");
};

const razlogTekst = (reason) => ({
    ok: "Uspješna prijava",
    bad_user: "Nepoznat korisnik",
    bad_password: "Kriva lozinka",
}[reason] || reason || "");

export default function LoginLogsPage() {
    const dispatch = useDispatch();
    const authData = useSelector(authSliceData);
    const username = authData?.loggedUserData?.username;

    // Top-meni pri navigaciji upali globalni overlay (authData.loading=true) i
    // očekuje da ga odredišna stranica ugasi. Ova stranica nema takav sync, pa bi
    // overlay ostao visjeti ("zapne") — gasimo ga odmah po dolasku.
    useEffect(() => { dispatch(setAuthData({ path: "loading", value: false })); }, [dispatch]);

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fKorisnik, setFKorisnik] = useState("");

    // Popis korisnika za filter — jedinstveni iz dohvaćenih zapisa.
    const korisnici = useMemo(
        () => [...new Set(logs.map((l) => l.username).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [logs]
    );
    const prikazani = useMemo(
        () => (fKorisnik ? logs.filter((l) => l.username === fKorisnik) : logs),
        [logs, fKorisnik]
    );

    const columns = useMemo(() => [
        { field: "createdAt", headerName: "Vrijeme", flex: 1.4, minWidth: 160, valueFormatter: (v) => formatDate(v) },
        { field: "username", headerName: "Korisnik", flex: 1, minWidth: 120 },
        {
            field: "reason", headerName: "Ishod", flex: 1.3, minWidth: 170,
            renderCell: (p) => <Chip size="small" color={p.row.success ? "success" : "error"} label={razlogTekst(p.row.reason)} />,
        },
        { field: "ip_address", headerName: "IP", flex: 1, minWidth: 120, valueGetter: (v) => v || "—" },
    ], []);

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
        timeout: 20000,
    }), [authData.backendURL]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        for (let pokusaj = 1; pokusaj <= 2; pokusaj++) {
            try {
                const r = await api.post("/portal/admin/login_logs", {});
                setLogs(r?.data?.logs ?? r?.data?.data?.logs ?? []);
                setError("");
                break;
            } catch (e) {
                if (pokusaj === 2) {
                    setError(e?.response?.data?.message || e.message || "Dohvat nije uspio.");
                } else {
                    await new Promise((r) => setTimeout(r, 800));
                }
            }
        }
        setLoading(false);
    }, [api]);

    useEffect(() => { if (username === ADMIN_USER) load(); }, [username, load]);

    if (username !== ADMIN_USER) {
        return <Box sx={{ p: 2 }}><Alert severity="error">Pristup je ograničen.</Alert></Box>;
    }

    return (
        <Box sx={{ p: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>Prijave na sustav</Typography>
                    <Typography variant="body2" color="text.secondary">Prijave portal korisnika — uspješne i neuspjele (zadnja 3 mjeseca)</Typography>
                </Box>
                <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Osvježi</Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="f-korisnik">Korisnik</InputLabel>
                    <Select labelId="f-korisnik" label="Korisnik" value={fKorisnik} onChange={(e) => setFKorisnik(e.target.value)}>
                        <MenuItem value="">Svi korisnici</MenuItem>
                        {korisnici.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ height: "72vh", minWidth: 640 }}>
                    <DataGrid
                        rows={prikazani}
                        columns={columns}
                        getRowId={(r) => r.id}
                        loading={loading}
                        disableRowSelectionOnClick
                        initialState={{
                            pagination: { paginationModel: { pageSize: 50, page: 0 } },
                            sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
                        }}
                        pageSizeOptions={[25, 50, 100, 250]}
                        localeText={{ noRowsLabel: "Nema zapisa." }}
                    />
                </Box>
            </Box>
        </Box>
    );
}
