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
    createPaymentOrderThunk,
    fetchPaymentOrdersThunk,
    financeSliceData,
} from "../../financeSlice";
import { provjeriIban } from "../../../../helpers/iban";
import { useLoading } from "../../../loading/useLoading";
import { providerPoKljucu, jeSepa } from "../payment_orders/providers";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const NOVI = "__novi__";

// Unos povrata u platni nalog. Ne piše ništa u bazu osim (po potrebi) novog
// naloga — stavka nastaje tek kad se storno stvarno izvrši, jer prije toga
// nema iznosa ni računa na koji bi se vezala.
//
// Što se traži ovisi o nalogu: SEPA traži primatelja i IBAN jer novac ide na
// račun koji upisuje operater, a kartični ne traži ništa — vraća se na karticu
// kojom je plaćeno, pa se podaci o transakciji čitaju s izvornog računa.
export default function RefundOrderDialog({ open, provider, amount, ticketsCount, defaultValue, onClose, onConfirm }) {
    const dispatch = useDispatch();
    const auth = useSelector((s) => s.auth);
    const { paymentOrders, paymentOrdersLoading, nalogSaving, nalogError } = useSelector(financeSliceData);
    const { tijekom } = useLoading();

    const opis = providerPoKljucu(provider);
    const naRacun = jeSepa(provider);

    const [nalog, setNalog] = useState("");
    const [noviNaziv, setNoviNaziv] = useState("");
    const [primatelj, setPrimatelj] = useState("");
    const [iban, setIban] = useState("");
    const [greska, setGreska] = useState(null);

    // Nude se samo otvoreni nalozi tog providera — u zatvoreni se ne smije
    // dodavati, a nalog druge kuće ide drugom primatelju.
    useEffect(() => {
        if (open) dispatch(fetchPaymentOrdersThunk({ status: "open", provider }));
    }, [open, provider, dispatch]);

    useEffect(() => {
        if (!open) return;
        setNalog(defaultValue?.payment_order_uuid || "");
        setPrimatelj(defaultValue?.recipient_name || "");
        setIban(defaultValue?.recipient_iban || "");
        setNoviNaziv("");
        setGreska(null);
    }, [open, defaultValue]);

    const provjeraIbana = useMemo(() => (iban ? provjeriIban(iban) : null), [iban]);
    const kreiraSe = nalog === NOVI;

    const mozeSpremiti = !kreiraSe && !!nalog
        && (!naRacun || (!!primatelj.trim() && !!provjeraIbana?.ok));

    const kreirajNalog = async () => {
        const naziv = noviNaziv.trim();
        if (!naziv) return;
        const res = await tijekom("Kreiranje naloga", () => dispatch(createPaymentOrderThunk({
            name: naziv,
            provider,
            created_by: auth?.loggedUserData?.username || "",
        })));
        if (res.meta.requestStatus === "fulfilled") {
            const novi = res.payload?.order;
            await dispatch(fetchPaymentOrdersThunk({ status: "open", provider }));
            setNalog(novi?.payment_order_uuid || "");
            setNoviNaziv("");
        } else {
            setGreska(res.payload?.message || "Nalog nije kreiran");
        }
    };

    const potvrdi = () => {
        const odabrani = paymentOrders.find((o) => o.payment_order_uuid === nalog);
        onConfirm({
            payment_order_uuid: nalog,
            payment_order_name: odabrani?.name || "",
            provider,
            ...(naRacun ? {
                recipient_name: primatelj.trim(),
                recipient_iban: provjeraIbana.iban,
            } : {}),
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{naRacun ? "Povrat na IBAN" : `Povrat na karticu — ${opis.label}`}</DialogTitle>
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
                        label={`Nalog — ${opis.label}`}
                        value={nalog}
                        onChange={(e) => setNalog(e.target.value)}
                        required
                        fullWidth
                        helperText={
                            paymentOrdersLoading
                                ? "Učitavanje naloga…"
                                : !paymentOrders.length
                                ? "Nema otvorenih naloga — kreiraj novi"
                                : "Nude se samo otvoreni nalozi"
                        }
                    >
                        {paymentOrders.map((o) => (
                            <MenuItem key={o.payment_order_uuid} value={o.payment_order_uuid}>
                                {o.name} · {o.items_count} povrata · {fmtEUR(o.total_amount)}
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
                                disabled={!noviNaziv.trim() || nalogSaving}
                                sx={{ mt: 1 }}
                            >
                                Kreiraj
                            </Button>
                        </Stack>
                    )}

                    {naRacun ? (
                        <>
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
                        </>
                    ) : (
                        <Alert severity="info">
                            Novac se vraća na karticu kojom je plaćeno. Podaci o izvornoj transakciji
                            (terminal, autorizacijski kod, maskirani broj kartice) čitaju se s računa —
                            ne upisuje se ništa.
                        </Alert>
                    )}

                    {(greska || nalogError) && <Alert severity="error">{greska || nalogError}</Alert>}
                    <Alert severity="info">
                        Povrat se u nalog upisuje tek kad storno prođe. Više storna može ići
                        u isti nalog, pa se {naRacun ? "banci" : `kući ${opis.label}`} predaju odjednom.
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
