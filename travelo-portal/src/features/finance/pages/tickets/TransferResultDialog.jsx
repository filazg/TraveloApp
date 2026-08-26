import {
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { invoicePdfUrl, ticketsPdfUrl } from "../../financeSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

// Isto što POS pokaže nakon prodaje: broj računa, iznos i PDF-ovi.
// Promjena karte završava izdanim računom, pa mora ponuditi isti dokument —
// bez toga operater vidi samo poruku da je gotovo, a račun mora ispisati ili
// poslati putniku.
export default function TransferResultDialog({ result, onClose }) {
    const inv = result?.invoice;
    const razlika = Number(inv?.total_amount || 0);
    return (
        <Dialog open={!!result} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleIcon color="success" />
                    <Typography variant="h6">Karte prebačene, račun izdan</Typography>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                {inv && (
                    <Stack spacing={2}>
                        <Stack spacing={1}>
                            <Typography>Broj: <b>{inv.invoice_no}/{inv.invoice_year}</b></Typography>
                            {inv.fiskal_required ? (
                                <Chip label="Fiskalizacija 2.0" color="primary" size="small" sx={{ alignSelf: "flex-start" }} />
                            ) : (
                                inv.invoice_fiskal_no && (
                                    <Typography variant="body2">
                                        Fiskalni broj: <b>{inv.invoice_fiskal_no}</b>
                                    </Typography>
                                )
                            )}
                            <Typography>
                                {razlika >= 0 ? "Naplaćeno" : "Za povrat"}: <b>{fmtEUR(Math.abs(razlika))}</b>
                            </Typography>
                            <Typography>Novih karata: <b>{inv.tickets_count}</b></Typography>
                            {result?.transfer?.transferred != null && (
                                <Typography variant="body2" color="text.secondary">
                                    Zatvorenih starih karata: {result.transfer.transferred}
                                </Typography>
                            )}
                        </Stack>

                        <Divider />

                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="outlined"
                                startIcon={<PictureAsPdfIcon />}
                                onClick={() => window.open(invoicePdfUrl(inv.invoice_uuid), "_blank")}
                            >
                                Račun PDF
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<PictureAsPdfIcon />}
                                disabled={!inv.order_uuid}
                                onClick={() => window.open(ticketsPdfUrl(inv.order_uuid), "_blank")}
                            >
                                Karte PDF
                            </Button>
                        </Stack>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Zatvori</Button>
            </DialogActions>
        </Dialog>
    );
}
