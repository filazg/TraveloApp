import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { FUNKCIJSKE_TIPKE, svePonudjeneRadnje } from "./shortcutActions";

// Osobne postavke operatera — za razliku od postavki sustava, ove nisu
// zaključane kodom jer ne diraju ni fiskalizaciju ni opremu, samo navike
// blagajnika. Vežu se uz prijavljenog operatera.
export default function OperatorSettingsModal() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const open = !!appData.modalsStates?.showOperatorSettingsModal;
    const username = appData.logedUser?.user_username;
    const paymentMethods = appData.basicData?.payment_methods || [];

    const [shortcuts, setShortcuts] = useState({});
    const [homeHarbor, setHomeHarbor] = useState("");
    const [autoArrival, setAutoArrival] = useState(false);

    // Luke iz plovidbenog reda, abecedno. Nudi se cijeli popis, ne samo luke
    // jedne linije — postavka stoji neovisno o tome koja je linija odabrana.
    const luke = [...(appData.transportData?.harbors || [])]
        .filter((h) => h?.code)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "hr"));

    useEffect(() => {
        if (!open) return;
        let otkazano = false;
        (async () => {
            try {
                const res = await window.api.app.getOperatorSettingsIPC(username);
                if (!otkazano && res?.ok) {
                    setShortcuts(res.data?.shortcuts || {});
                    setHomeHarbor(res.data?.home_harbor_code || "");
                    setAutoArrival(!!res.data?.auto_select_first_arrival);
                }
            } catch (e) {
                console.log("getOperatorSettingsIPC nije uspio:", e?.message || e);
            }
        })();
        return () => { otkazano = true; };
    }, [open, username]);

    const handleClose = () => {
        dispatch(setStateData({ path: "modalsStates/showOperatorSettingsModal", value: false }));
    };

    const handleChange = (tipka, value) => {
        setShortcuts((prev) => {
            const novi = { ...prev };
            if (!value) {
                delete novi[tipka];
                return novi;
            }
            // Ista radnja ne smije visjeti na dvije tipke — inače blagajnik ne
            // zna koja je "prava", a jedna od njih je sigurno greška u unosu.
            for (const k of Object.keys(novi)) {
                if (novi[k] === value) delete novi[k];
            }
            novi[tipka] = value;
            return novi;
        });
    };

    const handleSave = async () => {
        try {
            await window.api.app.setOperatorSettingsIPC({
                operater_username: username,
                shortcuts,
                home_harbor_code: homeHarbor || null,
                auto_select_first_arrival: autoArrival,
            });
            // Prečaci se čitaju iz store-a pri svakom pritisku tipke, pa se moraju
            // osvježiti odmah — bez ponovne prijave. Isto vrijedi za polaznu
            // luku: sljedeći odabir linije mora je već koristiti.
            await dispatch(setStateData({ path: "operatorSettings/shortcuts", value: shortcuts }));
            await dispatch(setStateData({ path: "operatorSettings/home_harbor_code", value: homeHarbor || null }));
            await dispatch(setStateData({ path: "operatorSettings/auto_select_first_arrival", value: autoArrival }));
            // Spremanje je kraj posla — prozor se zatvara umjesto da čeka još
            // jedan klik na Zatvori. Rezultat se ionako odmah vidi na gumbima.
            handleClose();
        } catch (e) {
            console.log("setOperatorSettingsIPC nije uspio:", e?.message || e);
        }
    };

    const radnje = svePonudjeneRadnje(paymentMethods);

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            {/* Naslov je ono što piše i u izborniku — svaka stavka izbornika
                otvara svoj dijalog, pa unutarnji podnaslov više ne treba. */}
            <DialogTitle sx={{ fontWeight: 800 }}>
                Osobne postavke
                <Typography variant="body2" color="text.secondary">
                    {username || "—"}
                </Typography>
            </DialogTitle>

            <DialogContent dividers>
                <Typography sx={{ fontWeight: 800, mb: 1 }}>Polazna luka</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Kad odaberete liniju, polazna luka se postavi na ovu, a uz nju i prvi
                    sljedeći polazak s te luke. Prazno znači da se luka bira ručno, kao
                    dosad. Ako linija ne pristaje u odabranu luku, polje ostaje prazno.
                </Alert>
                <TextField
                    select
                    size="small"
                    fullWidth
                    value={homeHarbor}
                    onChange={(e) => setHomeHarbor(e.target.value)}
                    sx={{ mb: 3 }}
                >
                    <MenuItem value="">
                        <em>— bez zadane luke —</em>
                    </MenuItem>
                    {luke.map((h) => (
                        <MenuItem key={h.code} value={h.code}>{h.name}</MenuItem>
                    ))}
                </TextField>

                <FormControlLabel
                    sx={{ mb: 3, display: "block" }}
                    control={
                        <Checkbox
                            checked={autoArrival}
                            onChange={(e) => setAutoArrival(e.target.checked)}
                        />
                    }
                    label={
                        <Box>
                            <Typography>Automatski odaberi prvu luku dolaska</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Uz odabrani polazak odmah se uzima prva ponuđena relacija.
                                Korisno na linijama s jednom uobičajenom relacijom; na
                                razgranatima ostavite isključeno pa relaciju birate sami.
                            </Typography>
                        </Box>
                    }
                />

                <Typography sx={{ fontWeight: 800, mb: 1 }}>Funkcijske tipke</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Funkcijska tipka pokreće odabranu radnju na prodajnom ekranu. Prazno
                    znači da tipka nije dodijeljena. Ista radnja može stajati samo na
                    jednoj tipki.
                </Alert>

                <Stack spacing={1.5}>
                    {FUNKCIJSKE_TIPKE.map((tipka) => (
                        <Stack key={tipka} direction="row" alignItems="center" spacing={2}>
                            <Box sx={{ width: 56, flexShrink: 0 }}>
                                <Typography sx={{ fontWeight: 800 }}>{tipka}</Typography>
                            </Box>
                            <TextField
                                select
                                size="small"
                                fullWidth
                                value={shortcuts[tipka] || ""}
                                onChange={(e) => handleChange(tipka, e.target.value)}
                            >
                                <MenuItem value="">
                                    <em>— nije dodijeljeno —</em>
                                </MenuItem>
                                {radnje.map((r) => (
                                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    ))}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} variant="outlined">Zatvori</Button>
                <Button onClick={handleSave} variant="contained">Spremi</Button>
            </DialogActions>
        </Dialog>
    );
}
