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

export default function DevicesPage() {
    const dispatch = useDispatch();
    const authData = useSelector(authSliceData);
    const username = authData?.loggedUserData?.username;

    // Top-meni pri navigaciji upali globalni overlay (authData.loading=true) i
    // očekuje da ga odredišna stranica ugasi. Ova stranica nema takav sync, pa bi
    // overlay ostao visjeti ("zapne") — gasimo ga odmah po dolasku.
    useEffect(() => { dispatch(setAuthData({ path: "loading", value: false })); }, [dispatch]);

    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    // Filteri: korisnik, uređaj (TID), verzija.
    const [fKorisnik, setFKorisnik] = useState("");
    const [fUredjaj, setFUredjaj] = useState("");
    const [fVerzija, setFVerzija] = useState("");

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
                const r = await api.post("/portal/admin/device_connections", {});
                setDevices(r?.data?.devices ?? r?.data?.data?.devices ?? []);
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

    // Jedinstvene vrijednosti za filtere (iz dohvaćenog loga).
    const korisnici = useMemo(
        () => [...new Set(devices.map((d) => d.username).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [devices]
    );
    const uredjaji = useMemo(
        () => [...new Set(devices.map((d) => d.tid).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [devices]
    );
    const verzije = useMemo(
        () => [...new Set(devices.map((d) => d.app_version).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [devices]
    );

    const prikazani = useMemo(() => devices.filter((d) =>
        (!fKorisnik || d.username === fKorisnik)
        && (!fUredjaj || d.tid === fUredjaj)
        && (!fVerzija || d.app_version === fVerzija)
    ), [devices, fKorisnik, fUredjaj, fVerzija]);

    const columns = useMemo(() => [
        { field: "createdAt", headerName: "Vrijeme", flex: 1.4, minWidth: 160, valueFormatter: (v) => formatDate(v) },
        { field: "username", headerName: "Korisnik", flex: 1, minWidth: 110, valueGetter: (v) => v || "—" },
        { field: "tid", headerName: "Uređaj (TID)", flex: 1, minWidth: 120 },
        {
            field: "client", headerName: "Klijent", flex: 0.8, minWidth: 100,
            renderCell: (p) => (p.row.client ? <Chip size="small" label={p.row.client} variant="outlined" /> : "—"),
        },
        { field: "app_version", headerName: "Verzija", flex: 0.8, minWidth: 100, valueGetter: (v) => v || "—" },
        { field: "ip_address", headerName: "IP", flex: 1, minWidth: 120, valueGetter: (v) => v || "—" },
    ], []);

    if (username !== ADMIN_USER) {
        return <Box sx={{ p: 2 }}><Alert severity="error">Pristup je ograničen.</Alert></Box>;
    }

    return (
        <Box sx={{ p: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>Uređaji i verzije</Typography>
                    <Typography variant="body2" color="text.secondary">Log spajanja uređaja — tko se, s kojom verzijom i kad prijavio</Typography>
                </Box>
                <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Osvježi</Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="f-korisnik">Korisnik</InputLabel>
                    <Select labelId="f-korisnik" label="Korisnik" value={fKorisnik} onChange={(e) => setFKorisnik(e.target.value)}>
                        <MenuItem value="">Svi korisnici</MenuItem>
                        {korisnici.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="f-uredjaj">Uređaj (TID)</InputLabel>
                    <Select labelId="f-uredjaj" label="Uređaj (TID)" value={fUredjaj} onChange={(e) => setFUredjaj(e.target.value)}>
                        <MenuItem value="">Svi uređaji</MenuItem>
                        {uredjaji.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="f-verzija">Verzija</InputLabel>
                    <Select labelId="f-verzija" label="Verzija" value={fVerzija} onChange={(e) => setFVerzija(e.target.value)}>
                        <MenuItem value="">Sve verzije</MenuItem>
                        {verzije.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ height: "72vh", minWidth: 760 }}>
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
                        localeText={{ noRowsLabel: "Nijedan uređaj se još nije javio." }}
                    />
                </Box>
            </Box>
        </Box>
    );
}
