import { useEffect, useState } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
    MenuItem, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { resolveBackendUrl } from "../../../../helpers/backendUrl";
import { setAuthData } from "../../../auth/authSlice";

const backendURL = resolveBackendUrl("/app");
const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrap = (r) => r?.data?.data?.data ?? r?.data?.data ?? r?.data ?? {};

const ZADANO = { template_key: "ticket_tamplate_1", summary_threshold: 0 };

// Izgled PDF karte.
//
// Dvije stvari, pa dvije kartice: PRIMJENA je odluka po prodajnom kanalu, a
// PREDLOŠCI su popis onoga što uopće postoji. Dok su bili na hrpi, ime u
// padajućem izborniku nije govorilo ništa o tome kako predložak izgleda.
export default function TicketTemplatesPage() {
    const dispatch = useDispatch();
    const [kartica, setKartica] = useState(0);
    const [kanali, setKanali] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [postavke, setPostavke] = useState({});
    const [ucitavanje, setUcitavanje] = useState(true);
    const [poruka, setPoruka] = useState(null);

    const ucitaj = async () => {
        setUcitavanje(true);
        try {
            const p = unwrap(await api.get("/portal/boat/ticket_templates"));
            setKanali(p.channels || []);
            setKatalog(p.catalog || []);
            const mapa = {};
            for (const t of p.templates || []) {
                mapa[t.channel] = { template_key: t.template_key, summary_threshold: t.summary_threshold };
            }
            setPostavke(mapa);
        } catch (e) {
            setPoruka({ severity: "error", text: e.response?.data?.data?.message || e.message });
        } finally {
            setUcitavanje(false);
        }
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        ucitaj();
    }, [dispatch]);

    // Kanal bez zapisa koristi zatečeni predložak — isti onaj koji je vrijedio i
    // prije nego su predlošci uvedeni.
    const zaKanal = (k) => postavke[k] || ZADANO;

    const promijeni = (kanal, polje, vrijednost) => {
        setPostavke((p) => ({ ...p, [kanal]: { ...zaKanal(kanal), [polje]: vrijednost } }));
    };

    const spremi = async (kanal) => {
        const v = zaKanal(kanal);
        try {
            await api.post("/portal/boat/ticket_templates", {
                channel: kanal,
                template_key: v.template_key,
                summary_threshold: Number(v.summary_threshold) || 0,
            });
            setPoruka({ severity: "success", text: "Spremljeno." });
            ucitaj();
        } catch (e) {
            setPoruka({ severity: "error", text: e.response?.data?.data?.message || e.message });
        }
    };

    // Ogledni PDF se otvara u novoj kartici: predložak se gleda u punoj veličini,
    // a ne kroz sličicu na kojoj se ionako ništa ne pročita.
    const otvoriOgled = (key) => {
        window.open(
            `${backendURL}/portal/boat/ticket_template_preview?template=${encodeURIComponent(key)}`,
            "_blank",
        );
    };

    // Gdje je koji predložak u upotrebi — bez toga se iz popisa ne vidi je li
    // predložak uopće negdje uključen.
    const kanaliZaPredlozak = (key) =>
        kanali.filter((k) => zaKanal(k.key).template_key === key).map((k) => k.label);

    if (ucitavanje) {
        return <Box sx={{ p: 4 }}><CircularProgress size={24} /></Box>;
    }

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                Predlošci PDF karte
            </Typography>

            {poruka && (
                <Alert severity={poruka.severity} sx={{ mb: 2 }} onClose={() => setPoruka(null)}>
                    {poruka.text}
                </Alert>
            )}

            <Tabs
                value={kartica}
                onChange={(_e, v) => setKartica(v)}
                sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
            >
                <Tab label="Primjena predložaka" />
                <Tab label="Predlošci karata" />
            </Tabs>

            {kartica === 0 && (
                <Stack spacing={2}>
                    {kanali.map((k) => {
                        const v = zaKanal(k.key);
                        const izabran = katalog.find((t) => t.key === v.template_key);
                        return (
                            <Card key={k.key} variant="outlined">
                                <CardContent>
                                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>{k.label}</Typography>
                                    <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                                        <TextField
                                            select
                                            size="small"
                                            label="Predložak"
                                            value={v.template_key}
                                            onChange={(e) => promijeni(k.key, "template_key", e.target.value)}
                                            sx={{ minWidth: 260 }}
                                        >
                                            {katalog.map((t) => (
                                                <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>
                                            ))}
                                        </TextField>

                                        {/* Sažetak podnosi samo predložak s jednom kartom po
                                            stranici; kod zbijenog karte i tako stanu na malo
                                            stranica pa dodatna nema što sažeti. */}
                                        <TextField
                                            type="number"
                                            size="small"
                                            label="Sažetak od"
                                            value={v.summary_threshold ?? 0}
                                            onChange={(e) => promijeni(k.key, "summary_threshold", e.target.value)}
                                            disabled={!izabran?.supports_summary}
                                            inputProps={{ min: 0 }}
                                            sx={{ width: 170 }}
                                            helperText={
                                                izabran?.supports_summary
                                                    ? "0 = nikad; inače od toliko karata"
                                                    : "predložak nema sažetak"
                                            }
                                        />

                                        <Box sx={{ flex: 1 }} />
                                        <Button
                                            variant="contained"
                                            startIcon={<SaveIcon />}
                                            onClick={() => spremi(k.key)}
                                            sx={{ mt: 0.5 }}
                                        >
                                            Spremi
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            )}

            {kartica === 1 && (
                <Stack spacing={2}>
                    {katalog.map((t) => {
                        const uUpotrebi = kanaliZaPredlozak(t.key);
                        return (
                            <Card key={t.key} variant="outlined">
                                <CardContent>
                                    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                                        <Typography fontWeight={700}>{t.label}</Typography>
                                        {t.supports_summary && (
                                            <Chip size="small" color="primary" variant="outlined" label="sa sažetkom" />
                                        )}
                                        <Box sx={{ flex: 1 }} />
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<PictureAsPdfIcon />}
                                            onClick={() => otvoriOgled(t.key)}
                                        >
                                            Ogledni PDF
                                        </Button>
                                    </Stack>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        {t.description}
                                    </Typography>

                                    <Divider sx={{ my: 1.5 }} />

                                    <Typography variant="caption" color="text.secondary">
                                        {uUpotrebi.length
                                            ? `U upotrebi: ${uUpotrebi.join(", ")}`
                                            : "Trenutno se ne koristi ni na jednom kanalu"}
                                    </Typography>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
