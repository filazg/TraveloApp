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
import SeopDiscountsTab from "./SeopDiscountsTab";

const backendURL = resolveBackendUrl("/app");
const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrap = (r) => r?.data?.data?.data ?? r?.data?.data ?? r?.data ?? {};

// SEOP (AKD) — evidencija izdanih i iskorištenih putnih karata.
//
// Četiri kartice jer su to četiri različita posla: VEZA je tehnička postavka i
// radi se jednom, DOJAVE su odluka što se šalje i mijenja se kroz uhodavanje,
// POPUSTI su novčana odluka ureda koja se spušta na uređaje, a CERTIFIKATI su
// datoteke koje istječu pa se mijenjaju same za sebe.
//
// Lozinke se s poslužitelja ne vraćaju — polje je prazno, a ispod stoji je li
// lozinka postavljena. Prazno polje pri spremanju znači "ne diraj".
const OKOLINE = [
    { value: "mock", label: "Mock — ništa se ne šalje" },
    { value: "test", label: "Test (seop.akd.hr:9444)" },
    { value: "prod", label: "Produkcija (seop.akd.hr:7444)" },
];

const DOJAVE = [
    { key: "send_opk", naslov: "Prodaja obične karte", opis: "DojaviProdajuOPKEur — svaka prodana karta" },
    { key: "send_ppk", naslov: "Prodaja povlaštene karte", opis: "DojaviProdajuPPK_3Eur — karte na otočnu iskaznicu" },
    { key: "send_cvikanje_obicna", naslov: "Ukrcaj — obična karta", opis: "DojaviCvikanje pri validaciji obične karte" },
    { key: "send_cvikanje_povlastena", naslov: "Ukrcaj — povlaštena karta", opis: "DojaviCvikanje pri validaciji povlaštene karte" },
    { key: "send_storno", naslov: "Storno karte", opis: "DojaviCvikanje bez vremena utroška" },
    { key: "send_isplovljenje", naslov: "Isplovljenje broda", opis: "DojaviIsplovljenje po polasku" },
    { key: "send_ponisti_cvikanje_obicna", naslov: "Poništenje ukrcaja — obična", opis: "PonistiCvikanjePojedinacna za običnu kartu" },
    { key: "send_ponisti_cvikanje_povlastena", naslov: "Poništenje ukrcaja — povlaštena", opis: "PonistiCvikanjePojedinacna za povlaštenu kartu" },
];

const CERTIFIKATI = [
    { vrsta: "p12", naslov: "Klijentski certifikat (.p12)", opis: "Privatni ključ kojim se potpisuju dojave i ostvaruje veza. Traži lozinku.", lozinka: true },
    { vrsta: "ca", naslov: "CA lanac SEOP-a (.crt)", opis: "Bez njega se poslužitelj SEOP-a ne provjerava.", lozinka: false },
    { vrsta: "sign", naslov: "Javni ključ SEOP-a (.cert)", opis: "Njime se provjerava potpis odgovora koji SEOP vrati.", lozinka: false },
];

export default function SeopPanel() {
    const dispatch = useDispatch();
    const [kartica, setKartica] = useState(0);
    const [postavke, setPostavke] = useState(null);
    const [certifikati, setCertifikati] = useState(null);
    const [akdDostupan, setAkdDostupan] = useState(true);
    const [ucitavanje, setUcitavanje] = useState(true);
    const [spremanje, setSpremanje] = useState(false);
    const [provjera, setProvjera] = useState(null);
    const [poruka, setPoruka] = useState(null);

    const ucitaj = async () => {
        setUcitavanje(true);
        try {
            const p = unwrap(await api.get("/portal/boat/seop_settings"));
            setPostavke(p.settings || null);
            setCertifikati(p.certs || null);
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
            const r = unwrap(await api.post("/portal/boat/seop_settings", postavke));
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
            const r = unwrap(await api.post("/portal/boat/seop_test", {}));
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
                    Servis koji drži certifikate (AKD) ne odgovara. Postavke se mogu uređivati,
                    ali učitavanje certifikata i provjera veze neće raditi.
                </Alert>
            )}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <Tabs value={kartica} onChange={(_e, v) => setKartica(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
                    <Tab label="Veza" />
                    <Tab label="Dojave" />
                    <Tab label="Popusti" />
                    <Tab label="Certifikati" />
                </Tabs>

                <CardContent>
                    {kartica === 0 && (
                        <Stack spacing={2.5}>
                            <TextField
                                select fullWidth label="Okolina"
                                value={postavke.environment || "mock"}
                                onChange={(e) => postavi("environment", e.target.value)}
                                helperText="U mock okolini se prema SEOP-u ne šalje ništa — dojave se samo pripremaju."
                            >
                                {OKOLINE.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                            </TextField>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                {/* OIB je podatak tvrtke, ne postavka integracije — mijenja
                                    se u Administracija → Tvrtka. */}
                                <TextField
                                    fullWidth label="OIB brodara (korisničko ime)"
                                    value={postavke.brodarev_oib || ""}
                                    InputProps={{ readOnly: true }}
                                    helperText={postavke.brodarev_oib
                                        ? "Iz Administracija → Tvrtka."
                                        : "Nije upisan u Administracija → Tvrtka."}
                                />
                                <TextField
                                    fullWidth type="password" label="Lozinka za web servis"
                                    placeholder={postavke.lozinka_postavljena ? "•••••• (postavljena)" : "nije postavljena"}
                                    onChange={(e) => postavi("lozinka", e.target.value)}
                                    helperText="Prazno polje ostavlja postojeću lozinku."
                                />
                            </Stack>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={!!postavke.tls_reject_unauthorized}
                                        onChange={(e) => postavi("tls_reject_unauthorized", e.target.checked)}
                                    />
                                }
                                label="Provjeravaj certifikat poslužitelja SEOP-a"
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5 }}>
                                Uključiti tek kad je učitan CA lanac AKD-a; bez njega veza ne prolazi.
                            </Typography>

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
                                Provjera zove dijagnostičku metodu SEOP-a koja vraća vrijeme iz njihove baze.
                                Ne šalje nikakve podatke o kartama.
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
                                label={<Typography sx={{ fontWeight: 800 }}>Dojava u SEOP je uključena</Typography>}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5 }}>
                                Dok je isključena, dojave se i dalje pripremaju i pamte, ali ne odlaze.
                                Uključenjem se šalju redom, pa se ne gubi promet nastao u pripremi.
                            </Typography>

                            <Divider />

                            {DOJAVE.map((d) => (
                                <Box key={d.key}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={postavke[d.key] !== false}
                                                onChange={(e) => postavi(d.key, e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ fontWeight: 700 }}>{d.naslov}</Typography>}
                                    />
                                    <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>
                                        {d.opis}
                                    </Typography>
                                </Box>
                            ))}

                            <Divider />

                            <TextField
                                type="date" fullWidth label="Dojavljuje se od datuma"
                                InputLabelProps={{ shrink: true }}
                                value={(postavke.send_from_date || "").slice(0, 10)}
                                onChange={(e) => postavi("send_from_date", e.target.value)}
                                helperText="Karte izdane prije ovog datuma se ne dojavljuju. Prazno znači sve."
                            />

                            <TextField
                                select fullWidth label="Oznaka pristupne točke"
                                value={postavke.ozn_pristup_tocke_source || "billing_device"}
                                onChange={(e) => postavi("ozn_pristup_tocke_source", e.target.value)}
                                helperText="Oznaka računala s kojeg je karta prodana, kako je SEOP traži."
                            >
                                <MenuItem value="billing_device">Oznaka naplatnog uređaja (TID)</MenuItem>
                                <MenuItem value="fixed">Jedna oznaka za sve</MenuItem>
                            </TextField>
                            {postavke.ozn_pristup_tocke_source === "fixed" && (
                                <TextField
                                    fullWidth label="Fiksna oznaka pristupne točke"
                                    value={postavke.ozn_pristup_tocke_fixed || ""}
                                    onChange={(e) => postavi("ozn_pristup_tocke_fixed", e.target.value)}
                                />
                            )}

                            <TextField
                                select fullWidth label="Broj linije prema SEOP-u"
                                value={postavke.line_no_source || "line_code"}
                                onChange={(e) => postavi("line_no_source", e.target.value)}
                                helperText="Ako naš kod linije nije i službeni broj, upisuje se zasebno na liniji."
                            >
                                <MenuItem value="line_code">Naš kod linije</MenuItem>
                                <MenuItem value="seop_line_no">Zaseban SEOP broj linije</MenuItem>
                            </TextField>

                            <TextField
                                select fullWidth label="Oznaka plovidbe (jop / voyageID)"
                                value={postavke.jop_source || "departure_uuid"}
                                onChange={(e) => postavi("jop_source", e.target.value)}
                                helperText="Ista oznaka ide u dojavu ukrcaja i u dojavu isplovljenja."
                            >
                                <MenuItem value="departure_uuid">Oznaka polaska</MenuItem>
                                <MenuItem value="voyage_code">Oznaka vožnje iz plovidbenog reda</MenuItem>
                            </TextField>
                        </Stack>
                    )}

                    {/* Popusti imaju svoj dohvat i svoje spremanje — ne dijele
                        `postavke` s ostalim karticama, pa ni gumb u podnožju. */}
                    {kartica === 2 && <SeopDiscountsTab />}

                    {kartica === 3 && (
                        <Stack spacing={2}>
                            {postavke.p12_subject && (
                                <Alert severity="info">
                                    <b>Nositelj:</b> {postavke.p12_subject}
                                    {postavke.p12_valid_to && <> · <b>vrijedi do:</b> {new Date(postavke.p12_valid_to).toLocaleDateString("hr-HR")}</>}
                                </Alert>
                            )}
                            {CERTIFIKATI.map((c) => (
                                <CertifikatRedak
                                    key={c.vrsta}
                                    opis={c}
                                    stanje={certifikati?.[c.vrsta]}
                                    onGotovo={(t) => { setPoruka(t); ucitaj(); }}
                                />
                            ))}
                        </Stack>
                    )}
                </CardContent>

                {kartica < 2 && (
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

// Jedan certifikat: odabir datoteke, lozinka ako je treba, i stanje onoga što
// je već na poslužitelju. Datoteka ide kao base64 — certifikati su mali, pa se
// izbjegava multipart kroz tri servisa.
function CertifikatRedak({ opis, stanje, onGotovo }) {
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
            await api.post("/portal/boat/seop_cert", {
                vrsta: opis.vrsta,
                naziv: datoteka.name,
                sadrzaj_base64: sadrzaj,
                lozinka: opis.lozinka ? lozinka : undefined,
            });
            setDatoteka(null);
            setLozinka("");
            if (unos.current) unos.current.value = "";
            onGotovo({ severity: "success", text: `${opis.naslov} je učitan.` });
        } catch (e) {
            onGotovo({ severity: "error", text: e.response?.data?.data?.message || e.message });
        } finally {
            setSalje(false);
        }
    };

    return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700 }}>{opis.naslov}</Typography>
                    <Chip
                        size="small"
                        label={stanje?.postoji ? (stanje.file || "postavljen") : "nije postavljen"}
                        color={stanje?.postoji ? "success" : "default"}
                        variant={stanje?.postoji ? "filled" : "outlined"}
                    />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{opis.opis}</Typography>

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
                    {opis.lozinka && (
                        <TextField
                            size="small" type="password" label="Lozinka certifikata"
                            value={lozinka}
                            onChange={(e) => setLozinka(e.target.value)}
                            sx={{ width: 220 }}
                        />
                    )}
                    <Button variant="contained" onClick={posalji} disabled={!datoteka || salje}>
                        {salje ? "Slanje…" : "UČITAJ"}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
