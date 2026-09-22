import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
    Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem,
    Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
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
    // očekuje da ga odredišna stranica ugasi. Ova stranica nema sync koji to radi,
    // pa bi overlay ostao visjeti ("zapne") — gasimo ga odmah po dolasku.
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
        // Bez timeouta bi povremeno spor/zaglavljen poziv ostavio ekran na
        // spinneru; ovako brzo padne pa se pokuša ponovo / ponudi Osvježi.
        timeout: 20000,
    }), [authData.backendURL]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        // Jedan tihi pokušaj ponovo — pokriva povremeni prekid/blip prije nego
        // korisniku pokažemo grešku.
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

            <Paper sx={{ p: 1 }}>
                {loading && devices.length === 0 ? (
                    <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
                ) : prikazani.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nema zapisa.</Typography>
                ) : (
                    <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 720, "& th, & td": { whiteSpace: "nowrap" } }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Vrijeme</TableCell>
                                <TableCell>Korisnik</TableCell>
                                <TableCell>Uređaj (TID)</TableCell>
                                <TableCell>Klijent</TableCell>
                                <TableCell>Verzija</TableCell>
                                <TableCell>IP</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {prikazani.map((d) => (
                                <TableRow key={d.id} hover>
                                    <TableCell>{formatDate(d.createdAt)}</TableCell>
                                    <TableCell>{d.username || "—"}</TableCell>
                                    <TableCell>{d.tid}</TableCell>
                                    <TableCell>
                                        {d.client
                                            ? <Chip size="small" label={d.client} variant="outlined" />
                                            : "—"}
                                    </TableCell>
                                    <TableCell><b>{d.app_version || "—"}</b></TableCell>
                                    <TableCell>{d.ip_address || "—"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
}
