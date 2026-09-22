import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
    Alert, Box, Button, Chip, CircularProgress, Divider, FormControlLabel, IconButton,
    LinearProgress, Paper, Stack, Switch, Tooltip, Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LayersClearIcon from "@mui/icons-material/LayersClear";
import { authSliceData, setAuthData } from "../auth/authSlice";

// Objava nove verzije desktop aplikacije (electron-updater feed). Pristup je
// ograničen na jednog korisnika (i ovdje i na backendu).
const ADMIN_USER = "nfilipec";
// Komad ~5 MB (base64 ~6.7 MB) — ispod 10 MB JSON limita gatewaya/BFF-a.
const CHUNK = 5 * 1024 * 1024;

const formatSize = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

function toBase64(bytes) {
    let bin = "";
    const sub = 0x8000; // po 32 kB da se ne prepuni stog kod String.fromCharCode
    for (let i = 0; i < bytes.length; i += sub) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + sub));
    }
    return btoa(bin);
}

// Razvrstavanje odabranih datoteka po ulozi u feedu.
function klasificiraj(fileList) {
    const out = { setup: null, blockmap: null, yml: null, ostalo: [] };
    for (const f of fileList) {
        const n = f.name.toLowerCase();
        if (n === "latest.yml") out.yml = f;
        else if (n.endsWith(".exe.blockmap")) out.blockmap = f;
        else if (n.endsWith(".exe")) out.setup = f;
        else out.ostalo.push(f.name);
    }
    return out;
}

export default function DeskUpdaterPage() {
    const dispatch = useDispatch();
    const authData = useSelector(authSliceData);

    // Top-meni pri navigaciji upali globalni overlay (authData.loading=true) i
    // očekuje da ga odredišna stranica ugasi. Ova stranica nema sync koji to radi,
    // pa bi overlay ostao visjeti ("zapne") — gasimo ga odmah po dolasku.
    useEffect(() => { dispatch(setAuthData({ path: "loading", value: false })); }, [dispatch]);
    const username = authData?.loggedUserData?.username;

    const [odabrano, setOdabrano] = useState({ setup: null, blockmap: null, yml: null, ostalo: [] });
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({}); // { filename: percent }
    const [poruka, setPoruka] = useState(null); // { tip, tekst }
    const [popis, setPopis] = useState([]);
    const [objavljena, setObjavljena] = useState(null);
    const [aktivna, setAktivna] = useState(false);
    const [mijenjamStatus, setMijenjamStatus] = useState(false);

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
    }), [authData.backendURL]);

    const dohvatiPopis = useCallback(async () => {
        try {
            const r = await api.get("/portal/desk_updater/list");
            setPopis(r?.data?.files ?? r?.data?.data?.files ?? []);
            setObjavljena(r?.data?.version ?? r?.data?.data?.version ?? null);
            setAktivna(r?.data?.active ?? r?.data?.data?.active ?? false);
        } catch (e) {
            // Popis nije kritičan; tiho.
            setPopis([]);
        }
    }, [api]);

    useEffect(() => { if (username === ADMIN_USER) dohvatiPopis(); }, [username, dohvatiPopis]);

    // Zaključano na jednog korisnika (uz backend provjeru).
    if (username !== ADMIN_USER) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="error">Pristup je ograničen.</Alert>
            </Box>
        );
    }

    const posaljiDatoteku = async (file) => {
        const total = Math.max(1, Math.ceil(file.size / CHUNK));
        for (let index = 0; index < total; index++) {
            const slice = file.slice(index * CHUNK, Math.min(file.size, (index + 1) * CHUNK));
            const bytes = new Uint8Array(await slice.arrayBuffer());
            const dataB64 = toBase64(bytes);
            await api.post("/portal/desk_updater/upload", {
                filename: file.name,
                index,
                total,
                dataB64,
                reset: index === 0,
            });
            setProgress((p) => ({ ...p, [file.name]: Math.round(((index + 1) / total) * 100) }));
        }
    };

    const postaviAktivnost = async (active) => {
        setMijenjamStatus(true);
        setPoruka(null);
        try {
            const r = await api.post("/portal/desk_updater/activate", { active });
            setAktivna(active);
            setPoruka({ tip: "success", tekst: r?.data?.message || r?.data?.data?.message || (active ? "Aktivirano." : "Deaktivirano.") });
            dohvatiPopis();
        } catch (e) {
            setPoruka({ tip: "error", tekst: `Promjena statusa nije uspjela: ${e?.response?.data?.message || e.message}` });
        } finally {
            setMijenjamStatus(false);
        }
    };

    const ukloni = async (filename) => {
        if (!window.confirm(`Ukloniti s feeda: ${filename}?`)) return;
        setPoruka(null);
        try {
            await api.post("/portal/desk_updater/delete", { filename });
            dohvatiPopis();
        } catch (e) {
            setPoruka({ tip: "error", tekst: `Uklanjanje nije uspjelo: ${e?.response?.data?.message || e.message}` });
        }
    };

    const deaktiviraj = async () => {
        if (!window.confirm("Deaktivirati aplikaciju — ukloniti SVE datoteke s feeda? Blagajne više neće dobivati nadogradnju (ostaju na trenutnoj verziji).")) return;
        setPoruka(null);
        try {
            const r = await api.post("/portal/desk_updater/delete", { all: true });
            setPoruka({ tip: "success", tekst: r?.data?.message || r?.data?.data?.message || "Feed je ispražnjen." });
            dohvatiPopis();
        } catch (e) {
            setPoruka({ tip: "error", tekst: `Deaktivacija nije uspjela: ${e?.response?.data?.message || e.message}` });
        }
    };

    const objavi = async () => {
        setPoruka(null);
        if (!odabrano.setup || !odabrano.yml) {
            setPoruka({ tip: "warning", tekst: "Obavezni su .exe (Setup) i latest.yml. Blockmap je preporučen." });
            return;
        }
        setUploading(true);
        setProgress({});
        try {
            // Redoslijed je bitan: prvo .exe i .blockmap, a latest.yml TEK NA KRAJU —
            // tako feed objavi novu verziju tek kad je paket već cijeli gore, pa
            // nijedna blagajna ne krene skidati polovičan .exe.
            await posaljiDatoteku(odabrano.setup);
            if (odabrano.blockmap) await posaljiDatoteku(odabrano.blockmap);
            await posaljiDatoteku(odabrano.yml);
            setPoruka({ tip: "success", tekst: "Verzija je učitana i stoji NEAKTIVNA. Uključi prekidač 'Aktivna za preuzimanje' kad želiš da je blagajne povuku." });
            setOdabrano({ setup: null, blockmap: null, yml: null, ostalo: [] });
            dohvatiPopis();
        } catch (e) {
            setPoruka({ tip: "error", tekst: `Objava nije uspjela: ${e?.response?.data?.message || e.message}` });
        } finally {
            setUploading(false);
        }
    };

    const red = (label, f) => (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Box sx={{ textAlign: "right", minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{f ? f.name : "—"}</Typography>
                {f && <Typography variant="caption" color="text.secondary">{formatSize(f.size)}</Typography>}
                {f && progress[f.name] != null && (
                    <LinearProgress variant="determinate" value={progress[f.name]} sx={{ mt: 0.5, borderRadius: 1 }} />
                )}
            </Box>
        </Stack>
    );

    return (
        <Box sx={{ p: 2, width: "100%", maxWidth: 760 }}>
            <Typography variant="h5" fontWeight={800}>Objava verzije (auto-update)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Učitaj feed datoteke nove verzije deska: <b>Setup .exe</b>, <b>.exe.blockmap</b> i <b>latest.yml</b>.
                Instalirane blagajne pokupe novu verziju kod sljedeće prijave.
            </Typography>

            {poruka && (
                <Alert severity={poruka.tip} sx={{ mb: 2 }} onClose={() => setPoruka(null)}>{poruka.tekst}</Alert>
            )}

            <Paper sx={{ p: 2, mb: 2 }}>
                <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} disabled={uploading}>
                    Odaberi datoteke (.exe, .blockmap, latest.yml)
                    <input
                        type="file"
                        hidden
                        multiple
                        onChange={(e) => { setOdabrano(klasificiraj([...e.target.files])); setPoruka(null); }}
                    />
                </Button>

                <Divider sx={{ my: 1.5 }} />
                {red("Setup (.exe)", odabrano.setup)}
                {red("Blockmap (.exe.blockmap)", odabrano.blockmap)}
                {red("Manifest (latest.yml)", odabrano.yml)}
                {odabrano.ostalo.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        Zanemareno (ne pripada feedu): {odabrano.ostalo.join(", ")}
                    </Alert>
                )}

                <Button
                    variant="contained"
                    startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                    onClick={objavi}
                    disabled={uploading || !odabrano.setup || !odabrano.yml}
                    sx={{ mt: 2 }}
                >
                    {uploading ? "Objavljujem…" : "Objavi verziju"}
                </Button>
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                        Trenutno na feedu {objavljena && <Chip size="small" label={`v${objavljena}`} sx={{ ml: 1 }} />}
                        {" "}<Chip size="small" color={aktivna ? "success" : "default"} label={aktivna ? "AKTIVNA" : "NEAKTIVNA"} sx={{ ml: 0.5 }} />
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        {popis.length > 0 && (
                            <Button
                                size="small" color="error" variant="outlined" startIcon={<LayersClearIcon />}
                                onClick={deaktiviraj} disabled={uploading}
                            >
                                Ukloni sve
                            </Button>
                        )}
                        <Button size="small" startIcon={<RefreshIcon />} onClick={dohvatiPopis} disabled={uploading}>Osvježi</Button>
                    </Stack>
                </Stack>
                <FormControlLabel
                    sx={{ mb: 1 }}
                    control={
                        <Switch
                            color="success"
                            checked={aktivna}
                            onChange={(e) => postaviAktivnost(e.target.checked)}
                            disabled={mijenjamStatus || uploading || popis.length === 0}
                        />
                    }
                    label={aktivna
                        ? "Aktivna za preuzimanje — blagajne dobivaju nadogradnju kod prijave"
                        : "Neaktivna — nadogradnja se ne nudi (datoteke ostaju spremne)"}
                />
                <Divider sx={{ mb: 1 }} />
                {popis.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Feed je prazan — aplikacija se ne nudi na nadogradnju.</Typography>
                ) : (
                    <Stack divider={<Divider flexItem />}>
                        {popis.map((f) => (
                            <Stack key={f.name} direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
                                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{f.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{formatSize(f.size)}</Typography>
                                <Tooltip title="Ukloni s feeda">
                                    <span>
                                        <IconButton size="small" color="error" onClick={() => ukloni(f.name)} disabled={uploading}>
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Paper>
        </Box>
    );
}
