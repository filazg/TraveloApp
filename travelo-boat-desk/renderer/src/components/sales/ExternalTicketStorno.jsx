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
            // Karta s ove blagajne se ne šalje natrag u popis — nudi se odmah,
            // samo se stornira drugim putem.
            setNalaz(podaci);
            // Povrat se nudi u sredstvu kojim je karta i plaćena, ako ga ova
            // blagajna ima u šifarniku. Blagajnik ga svejedno može promijeniti.
            const platioUuid = podaci.local
                ? podaci.ticket?.ticket_payment_method_uuid
                : podaci.ticket?.payment_method_uuid;
            const izvorno = sredstva.find((p) => (p.uuid || p.payment_method_uuid) === platioUuid);
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
        const prikaz = nalaz.display || {};
        const odgovor = await stornoPicker.ask({
            label: `Karta ${prikaz.code || ""} (${nalaz.business_premise?.name || ""})`,
            amount: Number(prikaz.price || 0),
        });
        if (!odgovor?.status) return;

        const placanje = {
            uuid: sredstvo.uuid || sredstvo.payment_method_uuid,
            name: sredstvo.name || sredstvo.payment_method_name,
            payment_type_acr: sredstvo.payment_type_acr,
        };

        setZauzeto(true);
        await dispatch(setStateData({ path: "status", value: "loading" }));
        await dispatch(setStateData({
            path: "loadingText",
            value: nalaz.local ? "Storno karte..." : "Storno karte s drugog prodajnog mjesta...",
        }));
        try {
            // Vlastita karta ide istim putem kao storno iz popisa — ondje storno
            // ispravlja izvorni račun. Tuđa dobiva zaseban storno račun.
            const res = nalaz.local
                ? await window.api.app.cancelTicketIPC({
                    ticket: nalaz.ticket,
                    user: appData.logedUser,
                    payment: placanje,
                    paymentData: {},
                    stornoPct: odgovor.value,
                })
                : await window.api.app.cancelExternalTicketIPC({
                    ticket_code: prikaz.code,
                    user: appData.logedUser,
                    payment: placanje,
                    paymentData: {},
                    stornoPct: odgovor.value,
                });
            const podaci = res?.data || {};
            if (podaci.ok === false) {
                const poruka = podaci.error?.message || "Storno nije izvršen.";
                setGreska(poruka);
                await dispatch(setStateData({ path: "alertData", value: { message: poruka, severity: "error" } }));
                return;
            }
            await dispatch(setStateData({
                path: "alertData",
                value: {
                    message: nalaz.local
                        ? `Karta ${prikaz.code} je stornirana.`
                        : `Storno izvršen — vraćeno ${Number(podaci.refund_amount || 0).toFixed(2)} EUR za kartu ${podaci.ticket_code} (${podaci.source?.name || ""}).`,
                    severity: "success",
                },
            }));
            // Popis karata ispod mora vidjeti novo stanje vlastite karte.
            if (nalaz.local) {
                const ticketsData = await window.api.app.getTicketsIPC();
                await dispatch(setStateData({ path: "workingData/tickets", value: ticketsData.data.tickets }));
            }
            setKod("");
            ocisti();
        } finally {
            setZauzeto(false);
            await dispatch(setStateData({ path: "status", value: "ready" }));
        }
    };

    const karta = nalaz?.display;

    return (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    Storno karte po oznaci
                </Typography>
                <TextField
                    size="small"
                    label="Oznaka karte"
                    value={kod}
                    // Bez pretvaranja u velika slova: blagajne izdaju oznake
                    // malim slovima, mobilna velikima, a traži se točno kako
                    // piše na karti.
                    onChange={(e) => setKod(e.target.value)}
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
                        <Typography sx={{ fontWeight: 800 }}>{karta.code}</Typography>
                        <Typography>{karta.type}</Typography>
                        <Typography>{karta.line}</Typography>
                        <Typography>
                            {karta.from} → {karta.to} · {karta.departure}
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>{Number(karta.price || 0).toFixed(2)} EUR</Typography>
                        <Chip
                            size="small"
                            label={`${nalaz.business_premise?.name || "—"} · ${nalaz.business_premise?.type_name || ""}`}
                            color={nalaz.allowed ? "info" : "default"}
                        />
                        {karta.status ? <Chip size="small" label={String(karta.status).toUpperCase()} /> : null}
                    </Stack>

                    {/* Brod je otišao, ali rok još teče — blagajnik to mora
                        vidjeti prije nego uzme novac iz ladice. */}
                    {nalaz.warning ? (
                        <Alert severity="warning" sx={{ mt: 1.5, fontWeight: 700 }}>{nalaz.warning}</Alert>
                    ) : null}

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
                            {/* Kod tuđe karte novac izlazi iz ove blagajne iako
                                prihod nikad nije bio u njoj — zato se takav storno
                                posebno iskazuje na zaključku smjene. */}
                            <Typography variant="body2" color="text.secondary">
                                {nalaz.local
                                    ? "Storno vlastite prodaje — ispravlja izvorni račun."
                                    : "Ide na zaključak kao storno s drugog prodajnog mjesta."}
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
