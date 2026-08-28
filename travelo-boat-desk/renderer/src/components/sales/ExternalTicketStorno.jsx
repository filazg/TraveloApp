import { useState } from "react";
import { Alert, Box, Button, Chip, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CancelIcon from "@mui/icons-material/Cancel";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { useStornoPercentagePicker } from "./StornoPercentagePicker";

// Storno karte prodane na drugom prodajnom mjestu. Putnik dolazi s kartom koju
// ova blagajna nikad nije izdala, pa se karta traži na poslužitelju po oznaci.
// Smije li se stornirati odlučuje poslužitelj — dopuštene su samo poslovnice i
// pokretne blagajne — a blagajnik vidi odakle je karta prije nego potvrdi.
export default function ExternalTicketStorno() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const stornoPicker = useStornoPercentagePicker();

    const [kod, setKod] = useState("");
    const [nalaz, setNalaz] = useState(null);
    const [greska, setGreska] = useState("");
    const [zauzeto, setZauzeto] = useState(false);
    const [sredstvoUuid, setSredstvoUuid] = useState("");

    const sredstva = appData.basicData?.payment_methods || [];

    const ocisti = () => {
        setNalaz(null);
        setGreska("");
    };

    const trazi = async () => {
        const oznaka = kod.trim();
        if (!oznaka || zauzeto) return;
        setZauzeto(true);
        ocisti();
        try {
            const res = await window.api.app.lookupExternalTicketIPC(oznaka);
            const podaci = res?.data || {};
            if (!podaci.ok) {
                setGreska(podaci.reason || "Karta nije pronađena.");
                return;
            }
            if (podaci.local) {
                setGreska("Karta je prodana na ovoj blagajni — storniraj je iz popisa karata ispod.");
                return;
            }
            setNalaz(podaci);
            // Povrat se nudi u sredstvu kojim je karta i plaćena, ako ga ova
            // blagajna ima u šifarniku. Blagajnik ga svejedno može promijeniti.
            const izvorno = sredstva.find((p) => (p.uuid || p.payment_method_uuid) === podaci.ticket?.payment_method_uuid);
            setSredstvoUuid(izvorno ? (izvorno.uuid || izvorno.payment_method_uuid) : "");
        } catch (error) {
            setGreska(error?.message || "Traženje nije uspjelo.");
        } finally {
            setZauzeto(false);
        }
    };

    const storniraj = async () => {
        if (!nalaz?.allowed || zauzeto) return;
        const sredstvo = sredstva.find((p) => (p.uuid || p.payment_method_uuid) === sredstvoUuid);
        if (!sredstvo) {
            setGreska("Odaberi sredstvo povrata.");
            return;
        }
        if (!stornoPicker.percentages.length) {
            setGreska("Nema definiranih postotaka storniranja — dodaj ih u portalu pa sinkroniziraj.");
            return;
        }
        const odgovor = await stornoPicker.ask({
            label: `Karta ${nalaz.ticket?.ticket_code || ""} (${nalaz.business_premise?.name || ""})`,
            amount: Number(nalaz.ticket?.single_price || 0),
        });
        if (!odgovor?.status) return;

        setZauzeto(true);
        await dispatch(setStateData({ path: "status", value: "loading" }));
        await dispatch(setStateData({ path: "loadingText", value: "Storno karte s drugog prodajnog mjesta..." }));
        try {
            const res = await window.api.app.cancelExternalTicketIPC({
                ticket_code: nalaz.ticket?.ticket_code,
                user: appData.logedUser,
                payment: {
                    uuid: sredstvo.uuid || sredstvo.payment_method_uuid,
                    name: sredstvo.name || sredstvo.payment_method_name,
                    payment_type_acr: sredstvo.payment_type_acr,
                },
                paymentData: {},
                stornoPct: odgovor.value,
            });
            const podaci = res?.data || {};
            if (!podaci.ok) {
                const poruka = podaci.error?.message || "Storno nije izvršen.";
                setGreska(poruka);
                await dispatch(setStateData({ path: "alertData", value: { message: poruka, severity: "error" } }));
                return;
            }
            await dispatch(setStateData({
                path: "alertData",
                value: {
                    message: `Storno izvršen — vraćeno ${Number(podaci.refund_amount || 0).toFixed(2)} EUR za kartu ${podaci.ticket_code} (${podaci.source?.name || ""}).`,
                    severity: "success",
                },
            }));
            setKod("");
            ocisti();
        } finally {
            setZauzeto(false);
            await dispatch(setStateData({ path: "status", value: "ready" }));
        }
    };

    const karta = nalaz?.ticket;

    return (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    Storno karte s drugog prodajnog mjesta
                </Typography>
                <TextField
                    size="small"
                    label="Oznaka karte"
                    value={kod}
                    onChange={(e) => setKod(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") trazi(); }}
                    sx={{ width: 220 }}
                />
                <Button variant="contained" startIcon={<SearchIcon />} onClick={trazi} disabled={zauzeto || !kod.trim()}>
                    TRAŽI
                </Button>
            </Stack>

            {greska ? <Alert severity="warning" sx={{ mt: 1.5 }}>{greska}</Alert> : null}

            {karta ? (
                <Box sx={{ mt: 1.5 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ fontWeight: 800 }}>{karta.ticket_code}</Typography>
                        <Typography>{karta.ticket_type_name}</Typography>
                        <Typography>{karta.line_name}</Typography>
                        <Typography>
                            {karta.departure_harbor_name} → {karta.arrival_harbor_name} · {karta.departure_planed}
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>{Number(karta.single_price || 0).toFixed(2)} EUR</Typography>
                        <Chip
                            size="small"
                            label={`${nalaz.business_premise?.name || "—"} · ${nalaz.business_premise?.type_name || ""}`}
                            color={nalaz.allowed ? "info" : "default"}
                        />
                        {karta.status ? <Chip size="small" label={String(karta.status).toUpperCase()} /> : null}
                    </Stack>

                    {nalaz.allowed ? (
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
                            <TextField
                                select
                                size="small"
                                label="Sredstvo povrata"
                                value={sredstvoUuid}
                                onChange={(e) => setSredstvoUuid(e.target.value)}
                                sx={{ width: 260 }}
                            >
                                {sredstva.map((p) => {
                                    const uuid = p.uuid || p.payment_method_uuid;
                                    return <MenuItem key={uuid} value={uuid}>{p.name || p.payment_method_name}</MenuItem>;
                                })}
                            </TextField>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<CancelIcon />}
                                onClick={storniraj}
                                disabled={zauzeto || !sredstvoUuid}
                            >
                                STORNIRAJ
                            </Button>
                            {/* Novac izlazi iz ove blagajne iako prihod nikad nije bio
                                u njoj — zato se takav storno posebno iskazuje na
                                zaključku smjene. */}
                            <Typography variant="body2" color="text.secondary">
                                Ide na zaključak kao storno s drugog prodajnog mjesta.
                            </Typography>
                        </Stack>
                    ) : (
                        <Alert severity="error" sx={{ mt: 1.5 }}>{nalaz.reason || "Karta se ne može stornirati na blagajni."}</Alert>
                    )}
                </Box>
            ) : null}

            {stornoPicker.dialog}
        </Paper>
    );
}
