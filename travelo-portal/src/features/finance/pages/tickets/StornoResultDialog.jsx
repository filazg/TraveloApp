import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
    Alert,
    Box,
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
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { emailInvoiceTicketsThunk, invoicePdfUrl } from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import { formatirajIban } from "../../../../helpers/iban";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

const ZADANI_NASLOV = "Storno računa i povrat";
const ZADANI_TEKST = "Poštovani,\n\n"
    + "Vaše karte su stornirane. U privitku se nalazi storno račun.\n\n"
    + "Stornirane karte više ne vrijede za ukrcaj.\n\n"
    + "Hvala na ukazanom povjerenju i mirno more!";

// Isto što POS pokaže nakon prodaje: broj računa, iznos i dokument. Storno
// završava izdanim računom, pa se mora ponuditi — bez toga operater vidi samo
// da je gotovo, a putnik ostaje bez potvrde o povratu.
export default function StornoResultDialog({ result, onClose }) {
    const dispatch = useDispatch();
    const inv = result?.invoice;
    const sepa = inv?.sepa_item;
    const povrat = Math.abs(Number(inv?.total_amount || 0));

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
        dispatch(setAuthData({ path: "loadingMessage", value: "Slanje emaila" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        // Bez `order_uuid` se šalje samo račun — kod storna karte se i ne
        // prilažu, jer više ne vrijede.
        const res = await dispatch(emailInvoiceTicketsThunk({
            invoice_uuid: inv.invoice_uuid,
            to: primatelj,
            subject: naslov || ZADANI_NASLOV,
            body: tekst || ZADANI_TEKST,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
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
                    <Typography variant="h6">Karte stornirane, račun izdan</Typography>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                {inv && (
                    <Stack spacing={2}>
                        <Stack spacing={1}>
                            <Typography>Broj: <b>{inv.invoice_no}/{inv.invoice_year}</b></Typography>
                            {inv.is_f2 ? (
                                <Chip label="Fiskalizacija 2.0" color="primary" size="small" sx={{ alignSelf: "flex-start" }} />
                            ) : (
                                inv.invoice_fiskal_no && (
                                    <Typography variant="body2">
                                        Fiskalni broj: <b>{inv.invoice_fiskal_no}</b>
                                    </Typography>
                                )
                            )}
                            <Typography>Za povrat: <b>{fmtEUR(povrat)}</b></Typography>
                            <Typography>Storniranih karata: <b>{result?.tickets_count || 0}</b></Typography>
                        </Stack>

                        {/* Povrat na račun nije vidljiv na samom računu, pa se ovdje
                            potvrđuje u koji je nalog upisan i kome ide. */}
                        {sepa && (
                            <Alert icon={<AccountBalanceIcon fontSize="inherit" />} severity="info">
                                <Typography variant="body2">
                                    Povrat na IBAN upisan u nalog — <b>{sepa.recipient_name}</b>
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                    {formatirajIban(sepa.recipient_iban)} · {fmtEUR(sepa.amount)}
                                </Typography>
                            </Alert>
                        )}

                        <Divider />

                        <Box>
                            <Button
                                variant="outlined"
                                startIcon={<PictureAsPdfIcon />}
                                onClick={() => window.open(invoicePdfUrl(inv.invoice_uuid), "_blank")}
                            >
                                Storno račun PDF
                            </Button>
                        </Box>

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
                                disabled={salje || !primatelj}
                                sx={{ alignSelf: "flex-start" }}
                            >
                                {salje ? "Slanje…" : "Pošalji"}
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
