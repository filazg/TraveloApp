import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
    Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, FormControl,
    InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import { authSliceData, setAuthData } from "../auth/authSlice";

// Zapis svakog poziva prema AKD-u (SEOP i MOSI) i njihovog odgovora.
//
// Zašto postoji: AKD odgovara porukama koje se vide samo na blagajni u trenutku
// prodaje — „Iskaznica nije pronađena (MXRF1)", SOAP Fault, istek veze. Kad se
// poslije pita zašto putniku pravo nije priznato ili zašto dojava nije prošla,
// jedini trag bio je `pm2 logs`, koji se rotira i u kojem se ne može tražiti po
// iskaznici.
const ADMIN_USER = "nfilipec";

const formatDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR");
};

// Uredaj se pokazuje brojem, a ako ga nema — nazivom. Uuid se ne pokazuje:
// blagajnik ga nigdje ne vidi, pa mu u pregledu nema sto ni raditi. Poziv koji
// nije krenuo s uredaja (portal, pozadinska radnja) pokazuje svoj izvor.
const oznakaUredaja = (r) =>
    r?.terminal_tid || r?.terminal_naziv || (r?.izvor && r.izvor !== "terminal" ? r.izvor : "—");

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function AkdLogsPage() {
    const dispatch = useDispatch();
    const authData = useSelector(authSliceData);
    const username = authData?.loggedUserData?.username;

    // Top-meni pri navigaciji upali globalni overlay i očekuje da ga odredišna
    // stranica ugasi; ova nema takav sync, pa bi ostao visjeti.
    useEffect(() => { dispatch(setAuthData({ path: "loading", value: false })); }, [dispatch]);

    const [logs, setLogs] = useState([]);
    const [ukupno, setUkupno] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [detalj, setDetalj] = useState(null);

    const [from, setFrom] = useState(danaUnazad(7));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [iskaznica, setIskaznica] = useState("");
    const [samo, setSamo] = useState("");
    const [sustav, setSustav] = useState("");
    // Uređaj se bira iz onoga što je u dohvaćenim zapisima — popis naplatnih
    // uređaja ovdje nije potreban, a zanimaju samo oni koji su AKD i zvali.
    const [terminal, setTerminal] = useState("");

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
        timeout: 30000,
    }), [authData.backendURL]);

    const load = useCallback(async (filtri) => {
        setLoading(true);
        setError("");
        try {
            const r = await api.post("/portal/admin/akd_logs", filtri);
            const d = r?.data?.data ?? r?.data ?? {};
            setLogs(d.logs || []);
            setUkupno(d.ukupno || 0);
        } catch (e) {
            setError(e?.response?.data?.data?.message || e?.response?.data?.message || e.message || "Dohvat nije uspio.");
            setLogs([]);
            setUkupno(0);
        }
        setLoading(false);
    }, [api]);

    // Filtri koji suzuju sam upit idu na poslužitelj; uređaj se bira nad već
    // dohvaćenim zapisima jer se popis uređaja iz njih i izvodi.
    const trazi = useCallback(() => {
        load({ from, to, iskaznica: iskaznica.trim() || undefined, samo: samo || undefined, sustav: sustav || undefined, limit: 1000 });
    }, [load, from, to, iskaznica, samo, sustav]);

    // Prvi dohvat ide sa zadanim rasponom, ne kroz `trazi` — inace bi se popis
    // osvjezavao na svaku promjenu filtra, pa i usred tipkanja broja iskaznice.
    useEffect(() => {
        if (username !== ADMIN_USER) return;
        load({ from: danaUnazad(7), to: new Date().toISOString().slice(0, 10), limit: 1000 });
    }, [username, load]);

    const uredaji = useMemo(() => {
        const m = new Map();
        for (const l of logs) {
            if (!l.terminal_uuid) continue;
            if (!m.has(l.terminal_uuid)) m.set(l.terminal_uuid, oznakaUredaja(l));
        }
        return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "hr"));
    }, [logs]);

    const prikazani = useMemo(
        () => (terminal ? logs.filter((l) => l.terminal_uuid === terminal) : logs),
        [logs, terminal]
    );

    const columns = useMemo(() => [
        { field: "createdAt", headerName: "Vrijeme", width: 160, valueFormatter: (v) => formatDate(v) },
        {
            field: "ok", headerName: "Ishod", width: 110,
            renderCell: (p) => (
                <Chip size="small" color={p.row.ok ? "success" : "error"} label={p.row.ok ? "prošlo" : "greška"} />
            ),
        },
        { field: "sustav", headerName: "Sustav", width: 80 },
        { field: "metoda", headerName: "Metoda", width: 190, valueGetter: (v) => v || "—" },
        {
            field: "uredaj", headerName: "Uređaj", width: 170,
            valueGetter: (_v, r) => oznakaUredaja(r),
        },
        { field: "iskaznica", headerName: "Iskaznica", width: 130, valueGetter: (v) => v || "—" },
        { field: "line_no", headerName: "Linija", width: 80, valueGetter: (v) => v || "—" },
        {
            field: "greska", headerName: "Poruka", flex: 1, minWidth: 240,
            valueGetter: (_v, r) => (r.greska_opis ? `${r.greska_kod ? `[${r.greska_kod}] ` : ""}${r.greska_opis}` : ""),
        },
        { field: "trajanje_ms", headerName: "ms", width: 80, valueGetter: (v) => (v ?? "—") },
    ], []);

    if (username !== ADMIN_USER) {
        return <Box sx={{ p: 2 }}><Alert severity="error">Pristup je ograničen.</Alert></Box>;
    }

    return (
        <Box sx={{ p: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>AKD log</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Pozivi prema SEOP-u i MOSI-ju i njihovi odgovori. Klik na redak otvara poslano i primljeno.
                    </Typography>
                </Box>
                <Button startIcon={<RefreshIcon />} onClick={trazi} disabled={loading}>Osvježi</Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
                <TextField size="small" type="date" label="Od" InputLabelProps={{ shrink: true }}
                    value={from} onChange={(e) => setFrom(e.target.value)} />
                <TextField size="small" type="date" label="Do" InputLabelProps={{ shrink: true }}
                    value={to} onChange={(e) => setTo(e.target.value)} />
                <TextField size="small" label="Iskaznica" value={iskaznica}
                    onChange={(e) => setIskaznica(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") trazi(); }}
                    placeholder="cijeli broj ili dio" sx={{ width: 200 }} />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="f-samo">Prikaz</InputLabel>
                    <Select labelId="f-samo" label="Prikaz" value={samo} onChange={(e) => setSamo(e.target.value)}>
                        <MenuItem value="">Svi pozivi</MenuItem>
                        <MenuItem value="greske">Samo greške</MenuItem>
                        <MenuItem value="poruke">S porukom AKD-a</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="f-sustav">Sustav</InputLabel>
                    <Select labelId="f-sustav" label="Sustav" value={sustav} onChange={(e) => setSustav(e.target.value)}>
                        <MenuItem value="">Oba</MenuItem>
                        <MenuItem value="SEOP">SEOP</MenuItem>
                        <MenuItem value="MOSI">MOSI</MenuItem>
                    </Select>
                </FormControl>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={trazi} disabled={loading}>Traži</Button>

                <Box sx={{ flex: 1 }} />

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="f-uredaj">Uređaj</InputLabel>
                    <Select labelId="f-uredaj" label="Uređaj" value={terminal} onChange={(e) => setTerminal(e.target.value)}>
                        <MenuItem value="">Svi uređaji</MenuItem>
                        {uredaji.map(([uuid, oznaka]) => <MenuItem key={uuid} value={uuid}>{oznaka}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Prikazano {prikazani.length} od {ukupno} zapisa u rasponu.
                {ukupno > logs.length && " Suzi raspon ili filtar da se vide stariji."}
            </Typography>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ height: "68vh", minWidth: 900 }}>
                    <DataGrid
                        rows={prikazani}
                        columns={columns}
                        getRowId={(r) => r.id}
                        loading={loading}
                        disableRowSelectionOnClick
                        onRowClick={(p) => setDetalj(p.row)}
                        sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
                        initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
                        pageSizeOptions={[25, 50, 100, 250]}
                        localeText={{ noRowsLabel: "Nema zapisa u tom rasponu." }}
                    />
                </Box>
            </Box>

            <Dialog open={!!detalj} onClose={() => setDetalj(null)} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {detalj?.metoda || "Poziv"} — {formatDate(detalj?.createdAt)}
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                        {detalj?.sustav} · {detalj?.okolina || "?"} · HTTP {detalj?.http_status ?? "—"} · {detalj?.trajanje_ms ?? "—"} ms
                        {detalj && oznakaUredaja(detalj) !== "—" ? ` · uređaj ${oznakaUredaja(detalj)}` : ""}
                        {detalj?.iskaznica ? ` · iskaznica ${detalj.iskaznica}` : ""}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    {detalj?.greska_opis && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {detalj.greska_kod ? `[${detalj.greska_kod}] ` : ""}{detalj.greska_opis}
                        </Alert>
                    )}
                    {/* Poslano i primljeno stoje kakvi jesu: pri dijagnozi se
                        gleda tocan oblik koji je otisao, ne njegov sazetak. */}
                    <Typography variant="subtitle2" fontWeight={800}>Poslano</Typography>
                    <Box component="pre" sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {detalj?.zahtjev || "—"}
                    </Box>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2 }}>Primljeno</Typography>
                    <Box component="pre" sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {detalj?.odgovor || "—"}
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
}
