import { useEffect, useState } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import {
    Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem,
    Stack, TextField, Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { resolveBackendUrl } from "../../../../helpers/backendUrl";
import { setAuthData } from "../../../auth/authSlice";

const api = axios.create({ baseURL: resolveBackendUrl("/app"), withCredentials: true });
const unwrap = (r) => r?.data?.data?.data ?? r?.data?.data ?? r?.data ?? {};

// Izgled PDF karte po prodajnom kanalu.
//
// Kanal je ovdje jer karta iz web prodaje i karta iz partnerske ne idu istom
// čovjeku: web kupac je putnik i dobiva je u pošti, partner je posrednik i
// najčešće je ispisuje.
//
// Popis kanala i predložaka dolazi s poslužitelja, ne stoji ovdje — predložak
// koji postoji u izborniku, a iza njega nema ničega, je zamka.
export default function TicketTemplatesPage() {
    const dispatch = useDispatch();
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
    const zaKanal = (k) => postavke[k] || { template_key: "compact", summary_threshold: 0 };

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

    if (ucitavanje) {
        return <Box sx={{ p: 4 }}><CircularProgress size={24} /></Box>;
    }

    return (
        <Box sx={{ width: "100%", maxWidth: 900 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                Predlošci PDF karte
            </Typography>

            {poruka && (
                <Alert severity={poruka.severity} sx={{ mb: 2 }} onClose={() => setPoruka(null)}>
                    {poruka.text}
                </Alert>
            )}

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
                                        helperText={izabran?.description || " "}
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
        </Box>
    );
}
