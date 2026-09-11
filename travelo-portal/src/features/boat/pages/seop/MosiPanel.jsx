import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
    FormControlLabel, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import { resolveBackendUrl } from "../../../../helpers/backendUrl";
import { setAuthData } from "../../../auth/authSlice";

const backendURL = resolveBackendUrl("/app");
const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrap = (r) => r?.data?.data?.data ?? r?.data?.data ?? r?.data ?? {};

// MOSI (AKD) — dojava korištenja invalidskih povlastica u brodskom prijevozu.
//
// Razlikuje se od SEOP-a u dvije stvari koje se vide i na ekranu: pružatelj se
// predstavlja API ključem (zasebnim za test i produkciju), a certifikat treba
// samo za potpis dojave utroška — ne i za samu vezu.
const OKOLINE = [
    { value: "mock", label: "Mock — ništa se ne šalje" },
    { value: "test", label: "Test (demo-mosi-extapi.akd.hr)" },
    { value: "prod", label: "Produkcija (mosi-extapi.akd.hr)" },
];

export default function MosiPanel() {
    const dispatch = useDispatch();
    const [kartica, setKartica] = useState(0);
    const [postavke, setPostavke] = useState(null);
    const [cert, setCert] = useState(null);
    const [akdDostupan, setAkdDostupan] = useState(true);
    const [ucitavanje, setUcitavanje] = useState(true);
    const [spremanje, setSpremanje] = useState(false);
    const [provjera, setProvjera] = useState(null);
    const [poruka, setPoruka] = useState(null);

    const ucitaj = async () => {
        setUcitavanje(true);
        try {
            const p = unwrap(await api.get("/portal/boat/mosi_settings"));
            setPostavke(p.settings || null);
            setCert(p.cert || null);
            setAkdDostupan(p.akd_dostupan !== false);
        } catch (e) {
            setPoruka({ severity: "error", text: e.response?.data?.data?.message || e.message });
        } finally {
            setUcitavanje(false);
            dispatch(setAuthData({ path: "loading", value: false }));
        }
    };

    useEffect(() => { ucitaj(); /* eslint-disable-next-line */ }, []);

    const postavi = (polje, vrijednost) => setPostavke((p) => ({ ...p, [polje]: vrijednost }));

    const spremi = async () => {
        setSpremanje(true);
        setPoruka(null);
        try {
            const r = unwrap(await api.post("/portal/boat/mosi_settings", postavke));
            if (r?.settings) setPostavke(r.settings);
            setPoruka({ severity: "success", text: "Postavke su spremljene." });
        } catch (e) {
            setPoruka({ severity: "error", text: e.response?.data?.data?.message || e.message });
        } finally {
            setSpremanje(false);
        }
    };

    const provjeriVezu = async () => {
        setProvjera({ radi: true });
        try {
            const r = unwrap(await api.post("/portal/boat/mosi_test", {}));
            setProvjera({ radi: false, ...r });
        } catch (e) {
            setProvjera({ radi: false, ok: false, message: e.response?.data?.data?.message || e.message });
        }
    };

    if (ucitavanje) {
        return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
    }
    if (!postavke) {
        return <Alert severity="error">Postavke se nisu učitale. Provjerite radi li servis za plovidbu.</Alert>;
    }

    return (
        <Box sx={{ width: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Chip
                    size="small"
                    label={postavke.enabled ? "dojava uključena" : "dojava isključena"}
                    color={postavke.enabled ? "success" : "default"}
                    sx={{ fontWeight: 700 }}
                />
                <Chip size="small" label={postavke.environment} variant="outlined" sx={{ fontWeight: 700 }} />
            </Stack>

            {poruka && <Alert severity={poruka.severity} sx={{ mb: 2 }} onClose={() => setPoruka(null)}>{poruka.text}</Alert>}
            {!akdDostupan && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Servis koji drži certifikat (AKD) ne odgovara. Postavke se mogu uređivati,
                    ali učitavanje certifikata i provjera veze neće raditi.
                </Alert>
            )}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <Tabs value={kartica} onChange={(_e, v) => setKartica(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
                    <Tab label="Veza" />
                    <Tab label="Dojave" />
                    <Tab label="Certifikat" />
                </Tabs>

                <CardContent>
                    {kartica === 0 && (
                        <Stack spacing={2.5}>
                            <TextField
                                select fullWidth label="Okolina"
                                value={postavke.environment || "mock"}
                                onChange={(e) => postavi("environment", e.target.value)}
                                helperText="U mock okolini se prema MOSI-ju ne šalje ništa."
                            >
                                {OKOLINE.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                            </TextField>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                    fullWidth type="password" label="API ključ — test"
                                    placeholder={postavke.api_key_test_postavljen ? "•••••• (postavljen)" : "nije postavljen"}
                                    onChange={(e) => postavi("api_key_test", e.target.value)}
                                    helperText="Prazno polje ostavlja postojeći ključ."
                                />
                                <TextField
                                    fullWidth type="password" label="API ključ — produkcija"
                                    placeholder={postavke.api_key_prod_postavljen ? "•••••• (postavljen)" : "nije postavljen"}
                                    onChange={(e) => postavi("api_key_prod", e.target.value)}
                                    helperText="AKD izdaje zaseban ključ za svaku okolinu."
                                />
                            </Stack>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                    fullWidth label="OIB ustanove (oibPU)"
                                    value={postavke.oib_pu || ""}
                                    onChange={(e) => postavi("oib_pu", e.target.value)}
                                />
                                <TextField
                                    fullWidth label="Oznaka osobe koja dojavljuje (IDOsobaPU)"
                                    value={postavke.id_osoba_pu || ""}
                                    onChange={(e) => postavi("id_osoba_pu", e.target.value)}
                                    helperText="Ulazi u riječ koja se digitalno potpisuje."
                                />
                            </Stack>

                            <Divider />

                            <Stack direction="row" spacing={2} alignItems="center">
                                <Button
                                    variant="outlined"
                                    startIcon={<NetworkCheckIcon />}
                                    onClick={provjeriVezu}
                                    disabled={provjera?.radi}
                                >
                                    {provjera?.radi ? "Provjera…" : "PROVJERI VEZU"}
                                </Button>
                                {provjera && !provjera.radi && (
                                    <Alert severity={provjera.ok ? "success" : "warning"} sx={{ flex: 1, py: 0 }}>
                                        {provjera.message}
                                    </Alert>
                                )}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                Provjera dohvaća katalog invalidskih prava. To je čitanje, ne dojava —
                                ništa se ne evidentira.
                            </Typography>
                        </Stack>
                    )}

                    {kartica === 1 && (
                        <Stack spacing={2}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={!!postavke.enabled}
                                        onChange={(e) => postavi("enabled", e.target.checked)}
                                    />
                                }
                                label={<Typography sx={{ fontWeight: 800 }}>Dojava u MOSI je uključena</Typography>}
                            />

                            <Divider />

                            <Box>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={postavke.send_utrosak !== false}
                                            onChange={(e) => postavi("send_utrosak", e.target.checked)}
                                        />
                                    }
                                    label={<Typography sx={{ fontWeight: 700 }}>Dojava utroška</Typography>}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>
                                    v2/dojavautroska/brodari — prava MOB100, MOB101, MOB600, MOB601, MOB800, MOB801
                                </Typography>
                            </Box>

                            <Box>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={postavke.send_storno !== false}
                                            onChange={(e) => postavi("send_storno", e.target.checked)}
                                        />
                                    }
                                    label={<Typography sx={{ fontWeight: 700 }}>Storno dojave</Typography>}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>
                                    Ide istom metodom, s opisom „STORNO – oznaka izvorne transakcije".
                                </Typography>
                            </Box>

                            <Box>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={!!postavke.sync_crna_lista}
                                            onChange={(e) => postavi("sync_crna_lista", e.target.checked)}
                                        />
                                    }
                                    label={<Typography sx={{ fontWeight: 700 }}>Dnevno povlačenje crne liste</Typography>}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>
                                    Iskaznice i parkirališne karte koje više ne vrijede — za rad bez mreže.
                                    {postavke.crna_lista_zadnji_dohvat
                                        ? ` Zadnji dohvat: ${new Date(postavke.crna_lista_zadnji_dohvat).toLocaleString("hr-HR")}.`
                                        : " Još nije povučena."}
                                </Typography>
                            </Box>

                            <Divider />

                            <TextField
                                type="date" fullWidth label="Dojavljuje se od datuma"
                                InputLabelProps={{ shrink: true }}
                                value={(postavke.send_from_date || "").slice(0, 10)}
                                onChange={(e) => postavi("send_from_date", e.target.value)}
                                helperText="Usluge pružene prije ovog datuma se ne dojavljuju. Prazno znači sve."
                            />
                        </Stack>
                    )}

                    {kartica === 2 && (
                        <Stack spacing={2}>
                            <Alert severity="info">
                                Certifikat služi samo za <b>potpis dojave utroška</b>; sama veza ide API ključem.
                                AKD-u se predaje <b>javni ključ</b> ovog certifikata — smije biti i vlastiti
                                („self-issued").
                            </Alert>
                            {postavke.p12_subject && (
                                <Alert severity="success">
                                    <b>Nositelj:</b> {postavke.p12_subject}
                                    {postavke.p12_valid_to && <> · <b>vrijedi do:</b> {new Date(postavke.p12_valid_to).toLocaleDateString("hr-HR")}</>}
                                </Alert>
                            )}
                            <PotpisniCertifikat
                                stanje={cert}
                                onGotovo={(t) => { setPoruka(t); ucitaj(); }}
                            />
                        </Stack>
                    )}
                </CardContent>

                {kartica !== 2 && (
                    <>
                        <Divider />
                        <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={spremi}
                                disabled={spremanje}
                            >
                                {spremanje ? "Spremanje…" : "SPREMI"}
                            </Button>
                        </Box>
                    </>
                )}
            </Card>
        </Box>
    );
}

function PotpisniCertifikat({ stanje, onGotovo }) {
    const [datoteka, setDatoteka] = useState(null);
    const [lozinka, setLozinka] = useState("");
    const [salje, setSalje] = useState(false);
    const unos = useRef(null);

    const posalji = async () => {
        if (!datoteka) return;
        setSalje(true);
        try {
            const sadrzaj = await new Promise((razrijesi, odbij) => {
                const citac = new FileReader();
                citac.onload = () => razrijesi(String(citac.result).split(",")[1]);
                citac.onerror = odbij;
                citac.readAsDataURL(datoteka);
            });
            await api.post("/portal/boat/mosi_cert", {
                naziv: datoteka.name,
                sadrzaj_base64: sadrzaj,
                lozinka,
            });
            setDatoteka(null);
            setLozinka("");
            if (unos.current) unos.current.value = "";
            onGotovo({ severity: "success", text: "Potpisni certifikat je učitan." });
        } catch (e) {
            onGotovo({ severity: "error", text: e.response?.data?.data?.message || e.message });
        } finally {
            setSalje(false);
        }
    };

    return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontWeight: 700 }}>Potpisni certifikat (.p12)</Typography>
                    <Chip
                        size="small"
                        label={stanje?.postoji ? (stanje.file || "postavljen") : "nije postavljen"}
                        color={stanje?.postoji ? "success" : "default"}
                        variant={stanje?.postoji ? "filled" : "outlined"}
                    />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ flexShrink: 0 }}>
                        ODABERI DATOTEKU
                        <input
                            ref={unos}
                            hidden
                            type="file"
                            onChange={(e) => setDatoteka(e.target.files?.[0] || null)}
                        />
                    </Button>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {datoteka ? datoteka.name : "—"}
                    </Typography>
                    <TextField
                        size="small" type="password" label="Lozinka certifikata"
                        value={lozinka}
                        onChange={(e) => setLozinka(e.target.value)}
                        sx={{ width: 220 }}
                    />
                    <Button variant="contained" onClick={posalji} disabled={!datoteka || salje}>
                        {salje ? "Slanje…" : "UČITAJ"}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
