import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
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
import {
    cancelTicketsThunk,
    fetchBillingDevicesFullThunk,
    fetchBusinessPremisesListThunk,
    financeSliceData,
} from "../../financeSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

export default function CancelTicketsModal({ open, tickets, onClose, onCanceled }) {
    const dispatch = useDispatch();
    const { billingDevicesFull, businessPremisesList, cancelLoading, cancelError } = useSelector(financeSliceData);
    const [terminal, setTerminal] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [percentage, setPercentage] = useState(100);
    const [localError, setLocalError] = useState(null);

    useEffect(() => {
        if (open && !billingDevicesFull.length) dispatch(fetchBillingDevicesFullThunk());
        if (open && !businessPremisesList.length) dispatch(fetchBusinessPremisesListThunk());
    }, [open, billingDevicesFull.length, businessPremisesList.length, dispatch]);

    useEffect(() => {
        if (!open) {
            setTerminal("");
            setPaymentMethod("");
            setPercentage(100);
            setLocalError(null);
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
        const res = await dispatch(
            cancelTicketsThunk({
                ticket_uuids: tickets.map((t) => t.ticket_uuid),
                terminal_uuid: terminal,
                payment_method_uuid: paymentMethod,
                percentage: Number(percentage),
            })
        );
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
                        <TextField
                            type="number"
                            label="Postotak povrata (%)"
                            value={percentage}
                            onChange={(e) => setPercentage(e.target.value)}
                            inputProps={{ min: 0, max: 100, step: 0.01 }}
                            fullWidth
                        />
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
        </Dialog>
    );
}
