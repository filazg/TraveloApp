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

// Spajanje partnera preko API-ja (T4B API) — svaki zahtjev, uspješan i ne.
//
// Zašto postoji: partner javi „ne radi", a dosad se nije imalo gdje vidjeti je
// li uopće došao do nas, s kojim TID-om, je li mu token istekao, je li kriva
// kontrolna oznaka ili ga je zaustavio limit. Zapis piše channel-api servis za
// svaki zahtjev; tajne (otp, token, ključ, control_code) se ne bilježe.
const ADMIN_USER = "nfilipec";

const formatDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR");
};

// Zahtjev bez ikakvog identiteta (bez tokena, TID-a i partnera) nije partner
// nego netko tko pretražuje adresu — internetski skener i slično.
const oznakaPartnera = (r) => r?.partner_name || r?.partner_acr || (r?.tid ? `TID ${r.tid}` : "SKENER");

// JSON se pokazuje uvučen; odrezan ili neispravan ostaje kakav jest.
const lijepo = (t) => {
    if (!t) return "—";
    try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; }
};

const bojaStatusa = (s) => (s >= 500 ? "error" : s === 429 ? "warning" : s >= 400 ? "error" : "success");

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function PartnerApiLogsPage() {
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
    // Sadržaj zahtjeva i odgovora dolazi tek uz otvoreni detalj.
    const [sadrzaj, setSadrzaj] = useState(null);
    const [sadrzajUcitava, setSadrzajUcitava] = useState(false);

    const [from, setFrom] = useState(danaUnazad(7));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [samo, setSamo] = useState("");
    const [putanja, setPutanja] = useState("");
    // Partner se bira nad dohvaćenim zapisima — zanimaju samo oni koji su zvali.
    const [partner, setPartner] = useState("");

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
        timeout: 30000,
    }), [authData.backendURL]);

    const load = useCallback(async (filtri) => {
        setLoading(true);
        setError("");
        try {
            const r = await api.post("/portal/admin/partner_api_logs", filtri);
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
            const r = await api.post("/portal/admin/partner_api_log", { id: red.id });
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
            path: putanja || undefined,
            limit: 2000,
        });
    }, [load, from, to, samo, putanja]);

    useEffect(() => {
        if (username !== ADMIN_USER) return;
        load({ from: danaUnazad(7), to: new Date().toISOString().slice(0, 10), limit: 2000 });
    }, [username, load]);

    const partneri = useMemo(() => {
        const m = new Map();
        for (const l of logs) {
            const kljuc = l.partner_uuid || (l.tid ? `tid:${l.tid}` : "nepoznat");
            if (!m.has(kljuc)) m.set(kljuc, oznakaPartnera(l));
        }
        return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "hr"));
    }, [logs]);

    const putanje = useMemo(
        () => [...new Set(logs.map((l) => l.path).filter(Boolean))].sort(),
        [logs]
    );

    const prikazani = useMemo(() => (partner
        ? logs.filter((l) => (l.partner_uuid || (l.tid ? `tid:${l.tid}` : "nepoznat")) === partner)
        : logs), [logs, partner]);

    const greske = useMemo(() => prikazani.filter((l) => !l.ok).length, [prikazani]);

    const columns = useMemo(() => [
        { field: "createdAt", headerName: "Vrijeme", width: 165, valueFormatter: (v) => formatDate(v) },
        {
            field: "status_code", headerName: "Status", width: 90,
            renderCell: (p) => <Chip size="small" color={bojaStatusa(p.value)} label={p.value ?? "—"} />,
        },
        { field: "method", headerName: "Metoda", width: 80 },
        { field: "path", headerName: "Poziv", width: 170 },
        {
            field: "partner", headerName: "Partner", width: 190,
            valueGetter: (_v, r) => oznakaPartnera(r),
            renderCell: (p) => (p.value === "SKENER"
                ? <Chip size="small" color="warning" label="SKENER" />
                : p.value),
        },
        { field: "tid", headerName: "TID", width: 110, valueGetter: (v) => v || "—" },
        { field: "order_number", headerName: "Narudžba", width: 150, valueGetter: (v) => v || "—" },
        { field: "error_msg", headerName: "Poruka", flex: 1, minWidth: 220, valueGetter: (v) => v || "" },
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
                    <Typography variant="h5" fontWeight={800}>API partneri — log spajanja</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Svaki zahtjev partnera prema API-ju: prijava, pretraga, narudžba, potvrda, otkaz — i odbijeni
                        (token, kontrolna oznaka, limit). Klik na redak otvara detalj.
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
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="f-poziv">Poziv</InputLabel>
                    <Select labelId="f-poziv" label="Poziv" value={putanja} onChange={(e) => setPutanja(e.target.value)}>
                        <MenuItem value="">Svi pozivi</MenuItem>
                        {putanje.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                        {putanja && !putanje.includes(putanja) && <MenuItem value={putanja}>{putanja}</MenuItem>}
                    </Select>
                </FormControl>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={trazi} disabled={loading}>Traži</Button>

                <Box sx={{ flex: 1 }} />

                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="f-partner">Partner</InputLabel>
                    <Select labelId="f-partner" label="Partner" value={partner} onChange={(e) => setPartner(e.target.value)}>
                        <MenuItem value="">Svi partneri</MenuItem>
                        {partneri.map(([k, naziv]) => <MenuItem key={k} value={k}>{naziv}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="text.secondary">
                    Prikazano {prikazani.length} od {ukupno} zapisa u rasponu.
                    {ukupno > logs.length && " Suzi raspon ili filtar da se vide stariji."}
                </Typography>
                {greske > 0 && <Chip size="small" color="error" variant="outlined" label={`${greske} s greškom`} />}
            </Stack>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ height: "68vh", minWidth: 1100 }}>
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
                        localeText={{ noRowsLabel: "Nema zahtjeva partnera u tom rasponu." }}
                    />
                </Box>
            </Box>

            <Dialog open={!!detalj} onClose={() => setDetalj(null)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {detalj?.method} {detalj?.path} — {formatDate(detalj?.createdAt)}
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                        HTTP {detalj?.status_code ?? "—"} · {detalj?.duration_ms ?? "—"} ms · {oznakaPartnera(detalj)}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    {detalj?.error_msg && <Alert severity="error" sx={{ mb: 2 }}>{detalj.error_msg}</Alert>}
                    <Stack spacing={0.75}>
                        {[
                            ["Partner", oznakaPartnera(detalj)],
                            ["Oznaka partnera", detalj?.partner_acr || "—"],
                            ["TID", detalj?.tid || "—"],
                            ["API korisnik", detalj?.api_user_uuid || "—"],
                            ["Narudžba", detalj?.order_number || "—"],
                            ["IP adresa", detalj?.ip_address || "—"],
                            ["Klijent (user agent)", detalj?.user_agent || "—"],
                        ].map(([k, v]) => (
                            <Stack key={k} direction="row" spacing={2}>
                                <Typography variant="body2" color="text.secondary" sx={{ width: 170, flexShrink: 0 }}>{k}</Typography>
                                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>{v}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                    {/* Sadržaj stoji kakav jest (tajna polja maskirana na
                        poslužitelju) — pri dijagnozi se gleda točan oblik. */}
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
