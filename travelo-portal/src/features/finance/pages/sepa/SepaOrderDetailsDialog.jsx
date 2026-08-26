import { useEffect } from "react";
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
import {
    deleteSepaOrderItemThunk,
    fetchSepaOrderDetailsThunk,
    financeSliceData,
    setSepaOrderStatusThunk,
} from "../../financeSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmtDateTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
};
// IBAN se čita u skupinama po četiri — tako se i uspoređuje s papirom.
const fmtIban = (v) => String(v || "").replace(/(.{4})/g, "$1 ").trim();

export default function SepaOrderDetailsDialog({ sepaOrderUuid, onClose, onChanged }) {
    const dispatch = useDispatch();
    const auth = useSelector((s) => s.auth);
    const { sepaOrderDetails, sepaOrderDetailsLoading, sepaSaving, sepaError } = useSelector(financeSliceData);
    const { order, items } = sepaOrderDetails || {};

    useEffect(() => {
        if (sepaOrderUuid) dispatch(fetchSepaOrderDetailsThunk(sepaOrderUuid));
    }, [dispatch, sepaOrderUuid]);

    const otvoren = order?.status === "open";

    const promijeniStatus = async () => {
        const res = await dispatch(setSepaOrderStatusThunk({
            sepa_order_uuid: sepaOrderUuid,
            status: otvoren ? "closed" : "open",
            by: auth?.loggedUserData?.username || "",
        }));
        if (res.meta.requestStatus === "fulfilled") {
            dispatch(fetchSepaOrderDetailsThunk(sepaOrderUuid));
            if (onChanged) onChanged();
        }
    };

    const obrisiStavku = async (sepa_item_uuid) => {
        const res = await dispatch(deleteSepaOrderItemThunk({ sepa_item_uuid }));
        if (res.meta.requestStatus === "fulfilled") {
            dispatch(fetchSepaOrderDetailsThunk(sepaOrderUuid));
            if (onChanged) onChanged();
        }
    };

    return (
        <Dialog open={!!sepaOrderUuid} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <span>{order?.name || "SEPA nalog"}</span>
                    <Chip
                        size="small"
                        label={otvoren ? "Otvoren" : "Zatvoren"}
                        color={otvoren ? "success" : "default"}
                        variant={otvoren ? "filled" : "outlined"}
                    />
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                        {order?.items_count || 0} stavki
                    </Typography>
                    <Typography fontWeight={800}>{fmtEUR(order?.total_amount)}</Typography>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                {sepaError && <Alert severity="error" sx={{ mb: 1 }}>{sepaError}</Alert>}
                {!sepaOrderDetailsLoading && !items?.length && (
                    <Alert severity="info">
                        Nalog je prazan. Stavke ulaze kroz storno karata, odabirom povrata na IBAN.
                    </Alert>
                )}
                {!!items?.length && (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Primatelj</TableCell>
                                <TableCell>IBAN</TableCell>
                                <TableCell align="right">Iznos</TableCell>
                                <TableCell>Storno račun</TableCell>
                                <TableCell>Karte</TableCell>
                                <TableCell>Uneseno</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map((s) => (
                                <TableRow key={s.sepa_item_uuid} hover>
                                    <TableCell>{s.recipient_name}</TableCell>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{fmtIban(s.recipient_iban)}</TableCell>
                                    <TableCell align="right"><b>{fmtEUR(s.amount)}</b></TableCell>
                                    <TableCell>{s.storno_invoice_code || "—"}</TableCell>
                                    <TableCell sx={{ maxWidth: 220, whiteSpace: "normal" }}>
                                        {s.ticket_codes || "—"}
                                    </TableCell>
                                    <TableCell>{fmtDateTime(s.createdAt)}</TableCell>
                                    <TableCell align="right">
                                        {/* Stavka se briše samo dok je nalog otvoren — nakon
                                            predaje banci evidencija mora ostati kakva je poslana. */}
                                        <Tooltip title={otvoren ? "Obriši stavku" : "Nalog je zatvoren"}>
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={!otvoren || sepaSaving}
                                                    onClick={() => obrisiStavku(s.sepa_item_uuid)}
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
                    disabled={sepaSaving}
                >
                    {otvoren ? "Zatvori nalog" : "Vrati u otvoreno"}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button onClick={onClose}>Zatvori prozor</Button>
            </DialogActions>
        </Dialog>
    );
}
