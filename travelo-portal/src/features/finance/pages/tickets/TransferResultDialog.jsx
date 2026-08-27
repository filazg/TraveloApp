import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
    Alert,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EmailIcon from "@mui/icons-material/Email";
import SendIcon from "@mui/icons-material/Send";
import { emailInvoiceTicketsThunk, invoicePdfUrl, ticketsPdfUrl } from "../../financeSlice";
import { useLoading } from "../../../loading/useLoading";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

const ZADANI_NASLOV = "Nove karte za vaše putovanje";
const ZADANI_TEKST = "Poštovani,\n\n"
    + "Vaše karte prebačene su na novi polazak. U privitku se nalaze nove karte i račun.\n\n"
    + "Karte ste dužni predočiti prilikom ukrcaja na brod. Možete ih isprintati u A4 formatu ili "
    + "predočiti na mobilnom uređaju. Molimo da ekran bude dobro osvijetljen i čist da bi se "
    + "pravilno skenirao QR kod.\n\n"
    + "QR kod je jedinstven i vrijedi samo prilikom prvog skeniranja.\n\n"
    + "Hvala na ukazanom povjerenju i mirno more!";

// Isto što POS pokaže nakon prodaje: broj računa, iznos, PDF-ovi i slanje
// putniku. Promjena karte završava izdanim računom, pa mora ponuditi isti
// dokument — bez toga operater vidi samo poruku da je gotovo.
export default function TransferResultDialog({ result, onClose }) {
    const dispatch = useDispatch();
    const { pokazi, sakrij } = useLoading();
    const inv = result?.invoice;
    const razlika = Number(inv?.total_amount || 0);

    const [primatelj, setPrimatelj] = useState("");
    const [naslov, setNaslov] = useState(ZADANI_NASLOV);
    const [tekst, setTekst] = useState(ZADANI_TEKST);
    const [salje, setSalje] = useState(false);
    const [stanje, setStanje] = useState(null); // { severity, message }

    // E-mail putnika stoji na karti — ako ga ima, ponudi ga odmah.
    useEffect(() => {
        if (result) {
            setPrimatelj(result.passenger_email || "");
            setNaslov(ZADANI_NASLOV);
            setTekst(ZADANI_TEKST);
            setStanje(null);
        }
    }, [result]);

    const posalji = async () => {
        if (!inv || !primatelj) return;
        setSalje(true);
        setStanje(null);
        pokazi("Priprema karata i računa, slanje e-maila");
        const res = await dispatch(emailInvoiceTicketsThunk({
            invoice_uuid: inv.invoice_uuid,
            order_uuid: inv.order_uuid,
            to: primatelj,
            subject: naslov || ZADANI_NASLOV,
            body: tekst || ZADANI_TEKST,
        }));
        sakrij();
        setSalje(false);
        if (res.meta.requestStatus === "fulfilled") {
            setStanje({ severity: "success", message: `Email poslan na ${primatelj}` });
        } else {
            setStanje({ severity: "error", message: res.payload?.message || "Slanje nije uspjelo" });
        }
    };

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

                        <Divider />

                        <Stack spacing={1.5}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <EmailIcon color="primary" fontSize="small" />
                                <Typography variant="subtitle2">Pošalji putniku emailom</Typography>
                            </Stack>
                            <TextField
                                label="Email primatelja"
                                type="email"
                                size="small"
                                value={primatelj}
                                onChange={(e) => setPrimatelj(e.target.value)}
                                fullWidth
                                required
                            />
                            <TextField
                                label="Naslov"
                                size="small"
                                value={naslov}
                                onChange={(e) => setNaslov(e.target.value)}
                                fullWidth
                            />
                            <TextField
                                label="Poruka"
                                size="small"
                                value={tekst}
                                onChange={(e) => setTekst(e.target.value)}
                                fullWidth
                                multiline
                                minRows={4}
                            />
                            {stanje && <Alert severity={stanje.severity}>{stanje.message}</Alert>}
                            <Button
                                variant="contained"
                                startIcon={<SendIcon />}
                                onClick={posalji}
                                disabled={salje || !primatelj || !inv.order_uuid}
                                sx={{ alignSelf: "flex-start" }}
                            >
                                {salje ? "Slanje…" : "Pošalji"}
                            </Button>
                            {!inv.order_uuid && (
                                <Typography variant="caption" color="text.secondary">
                                    Račun nema narudžbu pa se karte ne mogu priložiti.
                                </Typography>
                            )}
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
