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

// Komunikacija naplatnih uređaja (desk i mobilna) s poslužiteljem — svaki
// zahtjev, uspješan i ne.
//
// Zašto postoji: blagajna javi „podaci se ne sinkroniziraju", a dosad se nije
// imalo gdje vidjeti je li uređaj uopće došao do poslužitelja, je li mu token
// odbijen ili je dobio odgovor bez podataka. Zapis piše gateway; uz svaki
// odgovor stoji sažetak koliko je zapisa stiglo (npr. „lines: 0").
const ADMIN_USER = "nfilipec";

const formatDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR");
};

const lijepo = (t) => {
    if (!t) return "—";
    try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; }
};

const bojaStatusa = (s) => (s == null ? "default" : s === 429 ? "warning" : s >= 400 ? "error" : "success");

// Prazan popis u odgovoru (npr. „lines: 0") je najčešći znak da je uređaj
// dobio odgovor, ali bez podataka.
const imaPraznih = (sazetak) => /(^|· )[\w.]+: 0( |$)/.test(String(sazetak || ""));

const oznakaKlijenta = (c) => (c === "desk" ? "Desk" : c === "mobile" ? "Mobilna" : "—");

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function TerminalLogsPage() {
    const dispatch = useDispatch();
    const authData = useSelector(authSliceData);
    const username = authData?.loggedUserData?.username;

    // Top-meni pri navigaciji upali globalni overlay i očekuje da ga odredišna
    // stranica ugasi.
    useEffect(() => { dispatch(setAuthData({ path: "loading", value: false })); }, [dispatch]);

    const [logs, setLogs] = useState([]);
    const [ukupno, setUkupno] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [detalj, setDetalj] = useState(null);
    const [sadrzaj, setSadrzaj] = useState(null);
    const [sadrzajUcitava, setSadrzajUcitava] = useState(false);

    const [from, setFrom] = useState(danaUnazad(1));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [samo, setSamo] = useState("");
    const [klijent, setKlijent] = useState("");
    const [putanja, setPutanja] = useState("");
    // Uređaj se bira nad dohvaćenim zapisima — zanimaju samo oni koji su se javili.
    const [uredjaj, setUredjaj] = useState("");

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
        timeout: 30000,
    }), [authData.backendURL]);

    const load = useCallback(async (filtri) => {
        setLoading(true);
        setError("");
        try {
            const r = await api.post("/portal/admin/terminal_logs", filtri);
            const d = r?.data?.data ?? r?.data ?? {};
            setLogs(d.logs || []);
            setUkupno(d.total || 0);
        } catch (e) {
            setError(e?.response?.data?.data?.message || e?.response?.data?.message || e.message || "Dohvat nije uspio.");
            setLogs([]);
            setUkupno(0);
        }
        setLoading(false);
    }, [api]);

    const otvori = useCallback(async (red) => {
        setDetalj(red);
        setSadrzaj(null);
        setSadrzajUcitava(true);
        try {
            const r = await api.post("/portal/admin/terminal_log", { id: red.id });
            const d = r?.data?.data ?? r?.data ?? {};
            setSadrzaj(d.log || null);
        } catch {
            setSadrzaj(null);
        }
        setSadrzajUcitava(false);
    }, [api]);

    const trazi = useCallback(() => {
        load({
            from, to,
            samo: samo || undefined,
            client: klijent || undefined,
            path: putanja || undefined,
            limit: 2000,
        });
    }, [load, from, to, samo, klijent, putanja]);

    useEffect(() => {
        if (username !== ADMIN_USER) return;
        load({ from: danaUnazad(1), to: new Date().toISOString().slice(0, 10), limit: 2000 });
    }, [username, load]);

    const uredjaji = useMemo(
        () => [...new Set(logs.map((l) => l.tid || "nepoznat"))].sort((a, b) => a.localeCompare(b, "hr")),
        [logs]
    );

    const putanje = useMemo(
        () => [...new Set(logs.map((l) => l.path).filter(Boolean))].sort(),
        [logs]
    );

    const prikazani = useMemo(() => (uredjaj
        ? logs.filter((l) => (l.tid || "nepoznat") === uredjaj)
        : logs), [logs, uredjaj]);

    const greske = useMemo(() => prikazani.filter((l) => !l.ok).length, [prikazani]);
    const prazni = useMemo(() => prikazani.filter((l) => l.ok && imaPraznih(l.response_summary)).length, [prikazani]);

    const columns = useMemo(() => [
        { field: "createdAt", headerName: "Vrijeme", width: 165, valueFormatter: (v) => formatDate(v) },
        {
            field: "status_code", headerName: "Status", width: 100,
            renderCell: (p) => <Chip size="small" color={bojaStatusa(p.value)} label={p.value ?? "prekid"} />,
        },
        { field: "tid", headerName: "TID", width: 110, valueGetter: (v) => v || "—" },
        { field: "client", headerName: "Uređaj", width: 95, valueGetter: (v) => oznakaKlijenta(v) },
        { field: "method", headerName: "Metoda", width: 75 },
        { field: "path", headerName: "Poziv", width: 250 },
        {
            field: "response_summary", headerName: "Stiglo", flex: 1, minWidth: 240,
            renderCell: (p) => (
                <Typography variant="body2" sx={{ color: imaPraznih(p.value) ? "warning.dark" : "inherit", fontWeight: imaPraznih(p.value) ? 700 : 400 }} noWrap>
                    {p.value || ""}
                </Typography>
            ),
        },
        { field: "error_msg", headerName: "Poruka", flex: 1, minWidth: 200, valueGetter: (v) => v || "" },
        { field: "ip_address", headerName: "IP", width: 130, valueGetter: (v) => v || "—" },
        { field: "duration_ms", headerName: "ms", width: 75, valueGetter: (v) => (v ?? "—") },
    ], []);

    if (username !== ADMIN_USER) {
        return <Box sx={{ p: 2 }}><Alert severity="error">Pristup je ograničen.</Alert></Box>;
    }

    return (
        <Box sx={{ p: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>Komunikacija uređaja</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Svaki poziv deska i mobilne prema poslužitelju: uparivanje, sinkronizacija, slanje računa i smjena — i
                        odbijeni. Stupac „Stiglo" pokazuje koliko je zapisa došlo u odgovoru. Klik na redak otvara detalj.
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
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="f-samo">Prikaz</InputLabel>
                    <Select labelId="f-samo" label="Prikaz" value={samo} onChange={(e) => setSamo(e.target.value)}>
                        <MenuItem value="">Svi zahtjevi</MenuItem>
                        <MenuItem value="greske">Samo greške</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel id="f-klijent">Uređaj</InputLabel>
                    <Select labelId="f-klijent" label="Uređaj" value={klijent} onChange={(e) => setKlijent(e.target.value)}>
                        <MenuItem value="">Svi</MenuItem>
                        <MenuItem value="desk">Desk</MenuItem>
                        <MenuItem value="mobile">Mobilna</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="f-poziv">Poziv</InputLabel>
                    <Select labelId="f-poziv" label="Poziv" value={putanja} onChange={(e) => setPutanja(e.target.value)}>
                        <MenuItem value="">Svi pozivi</MenuItem>
                        {putanje.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                        {putanja && !putanje.includes(putanja) && <MenuItem value={putanja}>{putanja}</MenuItem>}
                    </Select>
                </FormControl>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={trazi} disabled={loading}>Traži</Button>

                <Box sx={{ flex: 1 }} />

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="f-tid">TID</InputLabel>
                    <Select labelId="f-tid" label="TID" value={uredjaj} onChange={(e) => setUredjaj(e.target.value)}>
                        <MenuItem value="">Svi uređaji</MenuItem>
                        {uredjaji.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="text.secondary">
                    Prikazano {prikazani.length} od {ukupno} zapisa u rasponu.
                    {ukupno > logs.length && " Suzi raspon ili filtar da se vide stariji."}
                </Typography>
                {greske > 0 && <Chip size="small" color="error" variant="outlined" label={`${greske} s greškom`} />}
                {prazni > 0 && <Chip size="small" color="warning" variant="outlined" label={`${prazni} s praznim popisom`} />}
            </Stack>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ height: "68vh", minWidth: 1300 }}>
                    <DataGrid
                        rows={prikazani}
                        columns={columns}
                        getRowId={(r) => r.id}
                        loading={loading}
                        disableRowSelectionOnClick
                        onRowClick={(p) => otvori(p.row)}
                        sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
                        initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
                        pageSizeOptions={[25, 50, 100, 250]}
                        localeText={{ noRowsLabel: "Nema poziva uređaja u tom rasponu." }}
                    />
                </Box>
            </Box>

            <Dialog open={!!detalj} onClose={() => setDetalj(null)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {detalj?.method} {detalj?.path} — {formatDate(detalj?.createdAt)}
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                        HTTP {detalj?.status_code ?? "prekid"} · {detalj?.duration_ms ?? "—"} ms · {detalj?.tid || "nepoznat uređaj"} · {oznakaKlijenta(detalj?.client)}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    {detalj?.error_msg && <Alert severity="error" sx={{ mb: 2 }}>{detalj.error_msg}</Alert>}
                    {detalj?.ok && imaPraznih(detalj?.response_summary) && (
                        <Alert severity="warning" sx={{ mb: 2 }}>Odgovor je stigao, ali bar jedan popis je prazan.</Alert>
                    )}
                    <Stack spacing={0.75}>
                        {[
                            ["TID", detalj?.tid || "—"],
                            ["Uređaj", oznakaKlijenta(detalj?.client)],
                            ["Uuid uređaja", detalj?.terminal_uuid || "—"],
                            ["Stiglo", detalj?.response_summary || "—"],
                            ["IP adresa", detalj?.ip_address || "—"],
                            ["Klijent (user agent)", detalj?.user_agent || "—"],
                        ].map(([k, v]) => (
                            <Stack key={k} direction="row" spacing={2}>
                                <Typography variant="body2" color="text.secondary" sx={{ width: 170, flexShrink: 0 }}>{k}</Typography>
                                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>{v}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                    {/* Tajna polja su maskirana, a dugi popisi skraćeni na
                        poslužitelju — puni broj zapisa stoji u „Stiglo". */}
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2 }}>Zahtjev</Typography>
                    <Box component="pre" sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 300 }}>
                        {sadrzajUcitava ? "Učitavanje…" : lijepo(sadrzaj?.request_body)}
                    </Box>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2 }}>Odgovor</Typography>
                    <Box component="pre" sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 400 }}>
                        {sadrzajUcitava ? "Učitavanje…" : lijepo(sadrzaj?.response_body)}
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
}
