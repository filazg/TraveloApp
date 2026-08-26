import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Paper,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import {
    cancelTicketsThunk,
    fetchBillingDevicesFullThunk,
    fetchBusinessPremisesListThunk,
    fetchStornoPercentagesThunk,
    financeSliceData,
} from "../../financeSlice";
import { formatirajIban } from "../../../../helpers/iban";
import { useLoading } from "../../../loading/useLoading";
import SepaRefundDialog from "./SepaRefundDialog";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

export default function CancelTicketsModal({ open, tickets, onClose, onCanceled }) {
    const dispatch = useDispatch();
    const { billingDevicesFull, businessPremisesList, stornoPercentages, cancelLoading, cancelError } = useSelector(financeSliceData);
    const auth = useSelector((s) => s.auth);
    const { tijekom } = useLoading();
    const [terminal, setTerminal] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    // Postotak se bira iz šifarnika, ne upisuje se slobodno — inače bi svaka
    // blagajna vraćala koliko hoće. Isti popis vrijedi i na mobilnoj i kod
    // promjene karte.
    const [percentageUuid, setPercentageUuid] = useState("");
    const [localError, setLocalError] = useState(null);
    // Povrat na račun: kad je postavljen, storno uz sebe nosi i stavku SEPA
    // naloga. Bez toga povrat ide odabranim sredstvom plaćanja, kao i dosad.
    const [sepa, setSepa] = useState(null);
    const [sepaOpen, setSepaOpen] = useState(false);

    useEffect(() => {
        if (open && !billingDevicesFull.length) dispatch(fetchBillingDevicesFullThunk());
        if (open && !businessPremisesList.length) dispatch(fetchBusinessPremisesListThunk());
        if (open && !stornoPercentages.length) dispatch(fetchStornoPercentagesThunk());
    }, [open, billingDevicesFull.length, businessPremisesList.length, stornoPercentages.length, dispatch]);

    useEffect(() => {
        if (!open) {
            setTerminal("");
            setPaymentMethod("");
            setPercentageUuid("");
            setLocalError(null);
            setSepa(null);
            setSepaOpen(false);
        }
    }, [open]);

    const officeBpUuids = new Set(
        businessPremisesList.filter((bp) => String(bp.type || "").toUpperCase() === "URED").map((bp) => bp.uuid)
    );
    const officeDevices = billingDevicesFull.filter(
        (bd) => bd.is_active && officeBpUuids.has(bd.business_premise_uuid)
    );
    const selectedTerminal = officeDevices.find((bd) => bd.uuid === terminal);
    const paymentMethods = (selectedTerminal?.payment || selectedTerminal?.payment_methods || []).filter(
        (pm) => pm.is_active
    );

    useEffect(() => {
        setPaymentMethod("");
    }, [terminal]);

    // Povrat na IBAN ima smisla samo uz transakcijski račun — fiskalna oznaka
    // "T". Gotovinom i karticom se vraća na licu mjesta, pa se SEPA nalog ni ne
    // nudi. Ako je unos već napravljen pa se sredstvo promijeni, briše se, da
    // storno ne ode s povratom koji tom sredstvu ne pripada.
    const odabranoSredstvo = paymentMethods.find((pm) => pm.uuid === paymentMethod);
    const naTransakcijski = String(odabranoSredstvo?.payment_type_acr || "").toUpperCase() === "T";

    useEffect(() => {
        if (!naTransakcijski && sepa) {
            setSepa(null);
            setSepaOpen(false);
        }
    }, [naTransakcijski, sepa]);

    // auto-select single URED device once lists are loaded
    useEffect(() => {
        if (open && !terminal && officeDevices.length === 1) {
            setTerminal(officeDevices[0].uuid);
        }
    }, [open, terminal, officeDevices]);

    const ticketsAmount = useMemo(
        () => tickets.reduce((s, t) => s + (parseFloat(t.single_price) || 0), 0),
        [tickets]
    );
    // Ponuđeni postotci: samo aktivni iz šifarnika, od najvećeg prema manjem —
    // puni povrat je najčešći slučaj pa stoji prvi.
    const postoci = useMemo(
        () => stornoPercentages
            .filter((p) => p && p.is_active !== false && Number.isFinite(Number(p.percentage)))
            .map((p) => ({ uuid: p.uuid, value: Number(p.percentage), name: p.name || "" }))
            .sort((a, b) => b.value - a.value),
        [stornoPercentages]
    );
    const percentage = useMemo(
        () => postoci.find((p) => p.uuid === percentageUuid)?.value ?? 0,
        [postoci, percentageUuid]
    );

    const refundAmount = useMemo(
        () => +(ticketsAmount * (Number(percentage) || 0) / 100).toFixed(2),
        [ticketsAmount, percentage]
    );

    const canSubmit =
        !cancelLoading &&
        tickets.length > 0 &&
        terminal &&
        paymentMethod &&
        Number(percentage) > 0;

    const handleSubmit = async () => {
        setLocalError(null);
        // Storno prije upisa povlači podatke iz backofficea, pa zna potrajati
        // nekoliko sekundi — bez prekrivača operater ne zna radi li se išta.
        const res = await tijekom("Storniranje karata", () => dispatch(
            cancelTicketsThunk({
                ticket_uuids: tickets.map((t) => t.ticket_uuid),
                terminal_uuid: terminal,
                payment_method_uuid: paymentMethod,
                percentage: Number(percentage),
                ...(sepa ? { sepa: { ...sepa, created_by: auth?.loggedUserData?.username || "" } } : {}),
            })
        ));
        if (res.meta.requestStatus === "fulfilled") {
            if (onCanceled) onCanceled(res.payload);
            onClose();
        } else {
            setLocalError(res.payload?.message || "Storno nije uspio");
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Storniranje karata</DialogTitle>
            <DialogContent dividers>
                {tickets.length === 0 ? (
                    <Alert severity="info">Nema odabranih karata.</Alert>
                ) : (
                    <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Broj karata</Typography>
                            <Typography fontWeight={700}>{tickets.length}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Iznos karata</Typography>
                            <Typography fontWeight={700}>{fmtEUR(ticketsAmount)}</Typography>
                        </Stack>
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                Postotak povrata
                            </Typography>
                            {postoci.length ? (
                                <ToggleButtonGroup
                                    exclusive
                                    value={percentageUuid}
                                    onChange={(_e, v) => { if (v !== null) setPercentageUuid(v); }}
                                    sx={{ display: "flex", flexWrap: "wrap", gap: 1, "& .MuiToggleButton-root": { flex: 1, minWidth: 120, borderRadius: 1.5, border: "1px solid", borderColor: "divider" } }}
                                >
                                    {postoci.map((p) => (
                                        <ToggleButton key={p.uuid} value={p.uuid} sx={{ flexDirection: "column", py: 1 }}>
                                            {/* 100.00 → "100 %", 12.50 → "12.5 %" */}
                                            <Typography fontWeight={800} lineHeight={1.2}>
                                                {`${String(p.value).replace(/\.0+$/, "")} %`}
                                            </Typography>
                                            {p.name && (
                                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: "none", lineHeight: 1.2 }}>
                                                    {p.name}
                                                </Typography>
                                            )}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            ) : (
                                <Alert severity="warning">
                                    Šifarnik postotaka storna je prazan — dopuštene vrijednosti dodaju se
                                    u Backoffice → Postotci storniranja.
                                </Alert>
                            )}
                        </Box>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Iznos za povrat</Typography>
                            <Typography fontWeight={800} color="error">{fmtEUR(refundAmount)}</Typography>
                        </Stack>
                        <TextField
                            select
                            label="Naplatni uređaj (URED)"
                            value={terminal}
                            onChange={(e) => setTerminal(e.target.value)}
                            required
                            fullWidth
                            helperText={!officeDevices.length ? "Nema uređaja u poslovnom prostoru tipa URED" : ""}
                        >
                            {officeDevices.map((bd) => (
                                <MenuItem key={bd.uuid} value={bd.uuid}>
                                    {bd.name} {bd.fiscal_mark ? `· ${bd.fiscal_mark}` : ""}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Sredstvo plaćanja (povrat)"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            required
                            disabled={!terminal || !paymentMethods.length}
                            fullWidth
                            helperText={
                                !terminal
                                    ? "Odaberi prvo naplatni uređaj"
                                    : !paymentMethods.length
                                    ? "Odabrani uređaj nema aktivnih sredstava plaćanja"
                                    : ""
                            }
                        >
                            {paymentMethods.map((pm) => (
                                <MenuItem key={pm.uuid} value={pm.uuid}>{pm.name}</MenuItem>
                            ))}
                        </TextField>

                        {/* Povrat na račun. Nije zamjena za sredstvo plaćanja —
                            storno se i dalje evidentira na uređaju, a ovdje se
                            bilježi kome i na koji IBAN novac stvarno ide.
                            Nudi se samo uz transakcijski račun (oznaka "T"). */}
                        {naTransakcijski && (
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                            {sepa ? (
                                <Stack spacing={1}>
                                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                                        <AccountBalanceIcon fontSize="small" color="primary" />
                                        <Typography fontWeight={700}>Povrat na IBAN</Typography>
                                        <Chip size="small" label={sepa.sepa_order_name || "SEPA nalog"} />
                                        <Box sx={{ flex: 1 }} />
                                        <Button size="small" onClick={() => setSepaOpen(true)}>Promijeni</Button>
                                        <Button size="small" color="error" onClick={() => setSepa(null)}>Ukloni</Button>
                                    </Stack>
                                    <Typography variant="body2">
                                        {sepa.recipient_name} · <span style={{ fontFamily: "monospace" }}>{formatirajIban(sepa.recipient_iban)}</span>
                                    </Typography>
                                </Stack>
                            ) : (
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography fontWeight={700}>Povrat na IBAN</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Novac se vraća na račun putnika i upisuje u SEPA nalog
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        startIcon={<AccountBalanceIcon />}
                                        onClick={() => setSepaOpen(true)}
                                        disabled={refundAmount <= 0}
                                    >
                                        Vrati na IBAN
                                    </Button>
                                </Stack>
                            )}
                        </Paper>
                        )}

                        {(localError || cancelError) && (
                            <Alert severity="error">{localError || cancelError}</Alert>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Odustani</Button>
                <Button
                    color="error"
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                >
                    Storniraj
                </Button>
            </DialogActions>

            <SepaRefundDialog
                open={sepaOpen}
                amount={refundAmount}
                ticketsCount={tickets.length}
                defaultValue={sepa}
                onClose={() => setSepaOpen(false)}
                onConfirm={setSepa}
            />
        </Dialog>
    );
}
