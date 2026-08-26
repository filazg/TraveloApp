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
    Divider,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
    createSepaOrderThunk,
    fetchSepaOrdersThunk,
    financeSliceData,
} from "../../financeSlice";
import { provjeriIban } from "../../../../helpers/iban";
import { useLoading } from "../../../loading/useLoading";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const NOVI = "__novi__";

// Unos povrata na račun. Ne piše ništa u bazu osim (po potrebi) novog naloga —
// stavka nastaje tek kad se storno stvarno izvrši, jer prije toga nema iznosa
// ni računa na koji bi se vezala.
export default function SepaRefundDialog({ open, amount, ticketsCount, defaultValue, onClose, onConfirm }) {
    const dispatch = useDispatch();
    const auth = useSelector((s) => s.auth);
    const { sepaOrders, sepaOrdersLoading, sepaSaving, sepaError } = useSelector(financeSliceData);
    const { tijekom } = useLoading();

    const [nalog, setNalog] = useState("");
    const [noviNaziv, setNoviNaziv] = useState("");
    const [primatelj, setPrimatelj] = useState("");
    const [iban, setIban] = useState("");
    const [greska, setGreska] = useState(null);

    // Nude se samo otvoreni nalozi — u zatvoreni se ne smije dodavati.
    useEffect(() => {
        if (open) dispatch(fetchSepaOrdersThunk({ status: "open" }));
    }, [open, dispatch]);

    useEffect(() => {
        if (!open) return;
        setNalog(defaultValue?.sepa_order_uuid || "");
        setPrimatelj(defaultValue?.recipient_name || "");
        setIban(defaultValue?.recipient_iban || "");
        setNoviNaziv("");
        setGreska(null);
    }, [open, defaultValue]);

    const provjeraIbana = useMemo(() => (iban ? provjeriIban(iban) : null), [iban]);
    const kreiraSe = nalog === NOVI;

    const mozeSpremiti =
        !kreiraSe &&
        !!nalog &&
        !!primatelj.trim() &&
        !!provjeraIbana?.ok;

    const kreirajNalog = async () => {
        const naziv = noviNaziv.trim();
        if (!naziv) return;
        const res = await tijekom("Kreiranje SEPA naloga", () => dispatch(createSepaOrderThunk({
            name: naziv,
            created_by: auth?.loggedUserData?.username || "",
        })));
        if (res.meta.requestStatus === "fulfilled") {
            const novi = res.payload?.order;
            await dispatch(fetchSepaOrdersThunk({ status: "open" }));
            setNalog(novi?.sepa_order_uuid || "");
            setNoviNaziv("");
        } else {
            setGreska(res.payload?.message || "Nalog nije kreiran");
        }
    };

    const potvrdi = () => {
        const odabrani = sepaOrders.find((o) => o.sepa_order_uuid === nalog);
        onConfirm({
            sepa_order_uuid: nalog,
            sepa_order_name: odabrani?.name || "",
            recipient_name: primatelj.trim(),
            recipient_iban: provjeraIbana.iban,
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Povrat na IBAN</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between">
                        <Typography>
                            Iznos povrata{ticketsCount ? ` (${ticketsCount} karata)` : ""}
                        </Typography>
                        <Typography fontWeight={800} color="error">{fmtEUR(amount)}</Typography>
                    </Stack>
                    <Divider />

                    <TextField
                        select
                        label="SEPA nalog"
                        value={nalog}
                        onChange={(e) => setNalog(e.target.value)}
                        required
                        fullWidth
                        helperText={
                            sepaOrdersLoading
                                ? "Učitavanje naloga…"
                                : !sepaOrders.length
                                ? "Nema otvorenih naloga — kreiraj novi"
                                : "Nude se samo otvoreni nalozi"
                        }
                    >
                        {sepaOrders.map((o) => (
                            <MenuItem key={o.sepa_order_uuid} value={o.sepa_order_uuid}>
                                {o.name} · {o.items_count} stavki · {fmtEUR(o.total_amount)}
                            </MenuItem>
                        ))}
                        <MenuItem value={NOVI}>
                            <AddIcon fontSize="small" sx={{ mr: 1 }} /> Kreiraj novi nalog…
                        </MenuItem>
                    </TextField>

                    {/* Novi nalog traži samo naziv — sve ostalo se puni stavkama. */}
                    {kreiraSe && (
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                            <TextField
                                autoFocus
                                label="Naziv novog naloga"
                                value={noviNaziv}
                                onChange={(e) => setNoviNaziv(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") kreirajNalog(); }}
                                fullWidth
                            />
                            <Button
                                variant="contained"
                                onClick={kreirajNalog}
                                disabled={!noviNaziv.trim() || sepaSaving}
                                sx={{ mt: 1 }}
                            >
                                Kreiraj
                            </Button>
                        </Stack>
                    )}

                    <TextField
                        label="Naziv primatelja"
                        value={primatelj}
                        onChange={(e) => setPrimatelj(e.target.value)}
                        required
                        fullWidth
                    />
                    <TextField
                        label="IBAN"
                        value={iban}
                        onChange={(e) => setIban(e.target.value)}
                        required
                        fullWidth
                        error={!!iban && !provjeraIbana?.ok}
                        helperText={
                            !iban
                                ? "npr. HR12 1001 0051 8630 0016 0"
                                : provjeraIbana?.ok
                                ? "IBAN je ispravan"
                                : provjeraIbana?.razlog
                        }
                        inputProps={{ style: { fontFamily: "monospace" } }}
                    />

                    {(greska || sepaError) && <Alert severity="error">{greska || sepaError}</Alert>}
                    <Alert severity="info">
                        Povrat se u nalog upisuje tek kad storno prođe. Više storna može ići
                        u isti nalog, pa se banci predaju odjednom.
                    </Alert>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Odustani</Button>
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" onClick={potvrdi} disabled={!mozeSpremiti}>
                    Potvrdi
                </Button>
            </DialogActions>
        </Dialog>
    );
}
