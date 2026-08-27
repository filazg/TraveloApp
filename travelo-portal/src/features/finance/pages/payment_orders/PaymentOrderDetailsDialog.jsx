import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import XLSX from "xlsx-js-style";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import DownloadIcon from "@mui/icons-material/Download";
import {
    deletePaymentOrderItemThunk,
    downloadSepaXml,
    fetchPaymentOrderDetailsThunk,
    financeSliceData,
    setPaymentOrderStatusThunk,
} from "../../financeSlice";
import { useLoading } from "../../../loading/useLoading";
import { formatirajIban } from "../../../../helpers/iban";
import { buildNalogWorkbook, nalogFileName } from "./nalogExcel";
import { providerPoKljucu, jeSepa } from "./providers";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmtDateTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
};

export default function PaymentOrderDetailsDialog({ paymentOrderUuid, onClose, onChanged }) {
    const dispatch = useDispatch();
    const auth = useSelector((s) => s.auth);
    const { paymentOrderDetails, paymentOrderDetailsLoading, nalogSaving, nalogError } = useSelector(financeSliceData);
    const { tijekom } = useLoading();
    const { order, items } = paymentOrderDetails || {};

    const [greskaDatoteke, setGreskaDatoteke] = useState(null);

    useEffect(() => {
        if (paymentOrderUuid) dispatch(fetchPaymentOrderDetailsThunk(paymentOrderUuid));
    }, [dispatch, paymentOrderUuid]);

    const otvoren = order?.status === "open";
    const provider = providerPoKljucu(order?.provider);
    const naRacun = jeSepa(order?.provider);

    // SEPA nalog ide banci kao pain.001 datoteka, kartični kućama kao izvještaj.
    // Oboje tek iz zatvorenog naloga: dok je otvoren u njega još ulaze stavke,
    // pa bi se predalo nešto što ne odgovara nalogu.
    const preuzmi = () => tijekom(naRacun ? "Priprema SEPA datoteke" : "Priprema izvještaja", async () => {
        setGreskaDatoteke(null);
        try {
            if (naRacun) {
                await downloadSepaXml(paymentOrderUuid);
                return;
            }
            await new Promise((r) => setTimeout(r, 50));
            const knjiga = buildNalogWorkbook(order, items || [], { providerLabel: provider.label });
            XLSX.writeFile(knjiga, nalogFileName(order));
        } catch (e) {
            setGreskaDatoteke(e.message);
        }
    });

    const promijeniStatus = async () => {
        const res = await tijekom(otvoren ? "Zatvaranje naloga" : "Otvaranje naloga", () => dispatch(setPaymentOrderStatusThunk({
            payment_order_uuid: paymentOrderUuid,
            status: otvoren ? "closed" : "open",
            by: auth?.loggedUserData?.username || "",
        })));
        if (res.meta.requestStatus === "fulfilled") {
            dispatch(fetchPaymentOrderDetailsThunk(paymentOrderUuid));
            if (onChanged) onChanged();
        }
    };

    const obrisiStavku = async (payment_item_uuid) => {
        const res = await tijekom("Brisanje stavke", () => dispatch(deletePaymentOrderItemThunk({ payment_item_uuid })));
        if (res.meta.requestStatus === "fulfilled") {
            dispatch(fetchPaymentOrderDetailsThunk(paymentOrderUuid));
            if (onChanged) onChanged();
        }
    };

    return (
        <Dialog open={!!paymentOrderUuid} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <span>{order?.name || "Platni nalog"}</span>
                    <Chip size="small" label={provider.label} color="primary" variant="outlined" />
                    <Chip
                        size="small"
                        label={otvoren ? "Otvoren" : "Zatvoren"}
                        color={otvoren ? "success" : "default"}
                        variant={otvoren ? "filled" : "outlined"}
                    />
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                        {order?.items_count || 0} povrata
                    </Typography>
                    <Typography fontWeight={800}>{fmtEUR(order?.total_amount)}</Typography>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                {nalogError && <Alert severity="error" sx={{ mb: 1 }}>{nalogError}</Alert>}
                {greskaDatoteke && <Alert severity="error" sx={{ mb: 1 }}>{greskaDatoteke}</Alert>}
                {paymentOrderDetailsLoading && (
                    <Stack alignItems="center" sx={{ py: 4 }}>
                        <CircularProgress />
                    </Stack>
                )}
                {!paymentOrderDetailsLoading && !items?.length && (
                    <Alert severity="info">
                        Nalog je prazan. Povrati u njega ulaze kroz storno karata — odabirom
                        {naRacun ? " povrata na IBAN." : ` povrata na karticu (${provider.label}).`}
                    </Alert>
                )}
                {!!items?.length && (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {naRacun ? (
                                    <>
                                        <TableCell>Primatelj</TableCell>
                                        <TableCell>IBAN</TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell>Kartica</TableCell>
                                        <TableCell>Autorizacija / TID</TableCell>
                                        <TableCell>Izvorni račun</TableCell>
                                    </>
                                )}
                                <TableCell align="right">Iznos</TableCell>
                                <TableCell>Storno račun</TableCell>
                                <TableCell>Karte</TableCell>
                                <TableCell>Uneseno</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map((s) => (
                                <TableRow key={s.payment_item_uuid} hover>
                                    {naRacun ? (
                                        <>
                                            <TableCell>{s.recipient_name}</TableCell>
                                            <TableCell sx={{ fontFamily: "monospace" }}>{formatirajIban(s.recipient_iban)}</TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell sx={{ fontFamily: "monospace" }}>
                                                {s.card_mask || "—"}
                                                {s.card_type ? <Typography variant="caption" color="text.secondary" display="block">{s.card_type}</Typography> : null}
                                            </TableCell>
                                            <TableCell sx={{ fontFamily: "monospace" }}>
                                                {s.auth_code || "—"}
                                                {s.terminal_id ? <Typography variant="caption" color="text.secondary" display="block">TID {s.terminal_id}</Typography> : null}
                                            </TableCell>
                                            <TableCell>{s.original_invoice_no || "—"}</TableCell>
                                        </>
                                    )}
                                    <TableCell align="right"><b>{fmtEUR(s.amount)}</b></TableCell>
                                    <TableCell>{s.storno_invoice_code || "—"}</TableCell>
                                    <TableCell sx={{ maxWidth: 200, whiteSpace: "normal" }}>{s.ticket_codes || "—"}</TableCell>
                                    <TableCell>{fmtDateTime(s.createdAt)}</TableCell>
                                    <TableCell align="right">
                                        {/* Stavka se briše samo dok je nalog otvoren — nakon
                                            predaje evidencija mora ostati kakva je poslana. */}
                                        <Tooltip title={otvoren ? "Obriši stavku" : "Nalog je zatvoren"}>
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={!otvoren || nalogSaving}
                                                    onClick={() => obrisiStavku(s.payment_item_uuid)}
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
            <DialogActions>
                <Button
                    startIcon={otvoren ? <LockIcon /> : <LockOpenIcon />}
                    color={otvoren ? "warning" : "success"}
                    onClick={promijeniStatus}
                    disabled={nalogSaving}
                >
                    {otvoren ? "Zatvori nalog" : "Vrati u otvoreno"}
                </Button>
                <Tooltip title={otvoren ? "Zatvori nalog da bi se dokument mogao preuzeti" : ""}>
                    <span>
                        <Button
                            variant="contained"
                            startIcon={<DownloadIcon />}
                            onClick={preuzmi}
                            disabled={otvoren || !items?.length}
                        >
                            {naRacun ? "Preuzmi SEPA datoteku" : "Preuzmi izvještaj (Excel)"}
                        </Button>
                    </span>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Button onClick={onClose}>Zatvori prozor</Button>
            </DialogActions>
        </Dialog>
    );
}
