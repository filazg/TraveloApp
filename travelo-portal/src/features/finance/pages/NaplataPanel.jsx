import { useState } from "react";
import { useDispatch } from "react-redux";
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { confirmInvoicePaymentThunk } from "../financeSlice";

// YesCor DocumentPaymentType.
const VRSTE_NAPLATE = { 1: "Transakcijski račun", 2: "Kompenzacija", 3: "Ostalo" };
const PRIJAVA_NAPLATE = {
    submitted: "poslana", new: "poslana", sending: "šalje se", sent: "prijavljena",
    error: "greška", failed: "greška", not_applicable: "",
};

// Stanje naplate za listu i detalj. null = racun prije uvodenja naplate,
// vodi se kao placen.
export const naplataInfo = (r) => {
    if (Number(r.invoice_amount) < 0) return { label: "Storno", bg: "#f0f0f0", fg: "#6b7280", tooltip: "" };
    if (r.invoice_paid === false) {
        return r.invoice_canceled
            ? { label: "Storniran", bg: "#f0f0f0", fg: "#6b7280", tooltip: "Neplaćen račun je storniran" }
            : { label: "Čeka naplatu", bg: "#fef9c3", fg: "#854d0e", tooltip: "Naplata nije potvrđena" };
    }
    const prijava = r.fiskal_required ? PRIJAVA_NAPLATE[r.yescor_payment_status] : "";
    const greska = r.fiskal_required && ["error", "failed"].includes(r.yescor_payment_status);
    return {
        label: greska ? "Naplaćeno ⚠" : "Naplaćeno",
        bg: greska ? "#ffcdd2" : "#c8e6c9",
        fg: greska ? "#b71c1c" : "#1b5e20",
        tooltip: [
            r.invoice_paid_date ? `Naplaćeno ${r.invoice_paid_date}` : "",
            r.invoice_paid_confirmed_by ? `potvrdio ${r.invoice_paid_confirmed_by}` : "",
            prijava ? `prijava Poreznoj: ${prijava}` : (r.fiskal_required && !r.yescor_payment_status ? "prijava Poreznoj: čeka fiskalizaciju" : ""),
            r.yescor_payment_error || "",
        ].filter(Boolean).join(" · "),
    };
};

const danas = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });

// Naplata racuna — stanje i naknadna potvrda za racune koji nisu placeni pri
// izdavanju (virman) i za zbirne partnerske racune. vrsta: 'racun' | 'partnerski'.
export default function NaplataPanel({ vrsta, uuid, invoice }) {
    const dispatch = useDispatch();
    const [datum, setDatum] = useState(danas());
    const [nacin, setNacin] = useState(1);
    const [salje, setSalje] = useState(false);
    const [poruka, setPoruka] = useState(null);

    const n = naplataInfo(invoice);
    const mozePotvrditi = invoice.invoice_paid === false && !invoice.invoice_canceled && Number(invoice.invoice_amount) >= 0;

    const potvrdi = async () => {
        setSalje(true);
        setPoruka(null);
        const rez = await dispatch(confirmInvoicePaymentThunk({ vrsta, invoice_uuid: uuid, paid_date: datum, paid_type: nacin }));
        setSalje(false);
        if (confirmInvoicePaymentThunk.fulfilled.match(rez)) {
            setPoruka({ severity: "success", text: invoice.fiskal_required ? "Naplata potvrđena i šalje se Poreznoj." : "Naplata potvrđena." });
        } else {
            setPoruka({ severity: "error", text: `Potvrda nije uspjela: ${rez.payload?.message || "nepoznata greška"}` });
        }
    };

    return (
        <Box sx={{ px: 3, py: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <Typography variant="body2" fontWeight={700}>Naplata</Typography>
                <Chip size="small" label={n.label} sx={{ bgcolor: n.bg, color: n.fg, fontWeight: 700 }} />
                {n.tooltip ? <Typography variant="caption" color="text.secondary">{n.tooltip}</Typography> : null}
                {invoice.invoice_paid && invoice.invoice_paid_type ? (
                    <Typography variant="caption" color="text.secondary">· {VRSTE_NAPLATE[invoice.invoice_paid_type]}</Typography>
                ) : null}
            </Stack>
            {mozePotvrditi ? (
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5, flexWrap: "wrap" }}>
                    <TextField
                        type="date"
                        size="small"
                        label="Datum naplate"
                        value={datum}
                        onChange={(e) => setDatum(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: danas() }}
                    />
                    <TextField
                        select
                        size="small"
                        label="Način"
                        value={nacin}
                        onChange={(e) => setNacin(Number(e.target.value))}
                        sx={{ width: 200 }}
                    >
                        {Object.entries(VRSTE_NAPLATE).map(([k, v]) => (
                            <MenuItem key={k} value={Number(k)}>{v}</MenuItem>
                        ))}
                    </TextField>
                    <Button variant="contained" size="small" disabled={salje || !datum} onClick={potvrdi}>
                        {salje ? "Potvrđujem…" : "Potvrdi naplatu"}
                    </Button>
                </Stack>
            ) : null}
            {poruka ? <Alert severity={poruka.severity} sx={{ mt: 1.5 }}>{poruka.text}</Alert> : null}
        </Box>
    );
}
