import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
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

    useEffect(() => {
        if (!open) return;
        let otkazano = false;
        (async () => {
            try {
                const res = await window.api.app.getOperatorSettingsIPC(username);
                if (!otkazano && res?.ok) setShortcuts(res.data?.shortcuts || {});
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
            await window.api.app.setOperatorSettingsIPC({ operater_username: username, shortcuts });
            // Prečaci se čitaju iz store-a pri svakom pritisku tipke, pa se moraju
            // osvježiti odmah — bez ponovne prijave.
            await dispatch(setStateData({ path: "operatorSettings/shortcuts", value: shortcuts }));
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
                Funkcijske tipke
                <Typography variant="body2" color="text.secondary">
                    {username || "—"}
                </Typography>
            </DialogTitle>

            <DialogContent dividers>
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
