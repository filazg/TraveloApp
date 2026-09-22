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
    // očekuje da ga odredišna stranica ugasi (kao ostali moduli u syncData). Ova
    // stranica nema takav sync, pa bi overlay ostao visjeti ("zapne") — gasimo ga
    // odmah po dolasku.
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
                    <Typography variant="body2" color="text.secondary">Prijave portal korisnika — uspješne i neuspjele</Typography>
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

            <Paper sx={{ p: 1 }}>
                {loading && logs.length === 0 ? (
                    <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
                ) : prikazani.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nema zapisa.</Typography>
                ) : (
                    <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 520, "& th, & td": { whiteSpace: "nowrap" } }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Vrijeme</TableCell>
                                <TableCell>Korisnik</TableCell>
                                <TableCell>Ishod</TableCell>
                                <TableCell>IP</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {prikazani.map((l) => (
                                <TableRow key={l.id} hover>
                                    <TableCell>{formatDate(l.createdAt)}</TableCell>
                                    <TableCell>{l.username}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={l.success ? "success" : "error"}
                                            label={razlogTekst(l.reason)}
                                        />
                                    </TableCell>
                                    <TableCell>{l.ip_address || "—"}</TableCell>
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
