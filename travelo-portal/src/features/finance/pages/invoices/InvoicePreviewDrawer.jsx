import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import {
    downloadInvoicePdf,
    fetchInvoiceDetailsThunk,
    financeSliceData,
} from "../../financeSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} EUR`;
const fmtDate = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
};
const fmtTime = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const statusBadge = (s) => {
    const map = {
        paid: { label: "Plaćeno", color: "success" },
        pending: { label: "U obradi", color: "warning" },
        declined: { label: "Odbijeno", color: "error" },
    };
    const cfg = map[s] || { label: s || "—", color: "default" };
    return <Chip size="small" label={cfg.label} color={cfg.color} />;
};

// Paper block that emulates a printed A4 invoice look.
const DocStyles = {
    fontFamily: `'Arial', 'Helvetica', sans-serif`,
    color: "#1a1a1a",
    "& table": { width: "100%", borderCollapse: "collapse" },
    "& td, & th": { verticalAlign: "top", padding: "4px 6px" },
    "& .head-row td": {
        fontSize: 13,
        lineHeight: 1.4,
    },
    "& .items th": {
        fontSize: 12,
        fontWeight: 700,
        borderBottom: "1px solid #bbb",
        textAlign: "left",
    },
    "& .items td": {
        fontSize: 12,
        borderBottom: "1px dotted #e5e5e5",
    },
    "& .totals td": {
        fontSize: 13,
    },
    "& .totals .label": { color: "#555" },
    "& .totals .total td": {
        fontSize: 14,
        fontWeight: 800,
        borderTop: "1px solid #999",
        paddingTop: 6,
    },
};

export default function InvoicePreviewDrawer({ invoice: invoiceFromList, onClose }) {
    const dispatch = useDispatch();
    const { invoiceDetails, invoiceDetailsLoading } = useSelector(financeSliceData);

    useEffect(() => {
        if (invoiceFromList?.invoice_uuid) dispatch(fetchInvoiceDetailsThunk(invoiceFromList.invoice_uuid));
    }, [dispatch, invoiceFromList?.invoice_uuid]);

    if (!invoiceFromList) return null;

    // List endpoint only returns a summary; details endpoint has the full record
    // including company_* fields. Prefer details, fall back to the row.
    const invoice = invoiceDetails?.invoice || invoiceFromList;
    const items = invoiceDetails?.items || [];
    const details = invoiceDetails?.details || [];

    const onDownload = async () => {
        try {
            await downloadInvoicePdf(
                invoice.invoice_uuid,
                `racun-${invoice.invoice_no || invoice.invoice_uuid.slice(0, 8)}.pdf`
            );
        } catch (e) {
            console.error("download failed", e);
            alert("Preuzimanje nije uspjelo. Provjeri jesi li prijavljen.");
        }
    };

    // F2 — nema NO/PP/NU sekvencu nego vlastiti kod u invoice_code; po njemu se
    // račun i prepoznaje, pa stoji u naslovu.
    // R1 bez F2 ide u istu fiskalnu sekvencu kao B2C račun, dakle ista oznaka —
    // razlikuju ga samo podaci o kupcu (usklađeno s ispisom na blagajni).
    // Fallback ako invoice_code još nije propagiran: invoice_no/BP/BD.
    const fiscalLabel = invoice.invoice_code || [
        invoice.invoice_no,
        invoice.invoice_business_premise_fiscal_mark,
        invoice.invoice_billing_device_fiscal_mark,
    ].filter(Boolean).join("/");
    const invoiceTitle = invoice.fiskal_required
        ? `F2 Račun/Invoice ${fiscalLabel}`
        : `Račun/Invoice ${fiscalLabel}`;

    let runningIdx = 0;

    return (
        <Box sx={{ width: { xs: "100vw", sm: 780 }, height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Sticky bar above the document — not part of the printed look */}
            <Box
                sx={{
                    px: 3,
                    py: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={800}>
                            Račun #{invoice.invoice_no || "—"}
                        </Typography>
                        {statusBadge(invoice.invoice_status)}
                    </Stack>
                    <Button size="small" onClick={onClose} startIcon={<CloseIcon />}>
                        Zatvori
                    </Button>
                </Stack>
            </Box>

            {/* The document — styled to resemble the generated PDF */}
            <Box sx={{ flex: 1, overflow: "auto", bgcolor: "#f2f2f2", py: 3 }}>
                <Paper
                    elevation={2}
                    sx={{
                        mx: "auto",
                        maxWidth: 720,
                        p: 5,
                        bgcolor: "#ffffff",
                        ...DocStyles,
                    }}
                >
                    {/* Barcode/UUID label */}
                    <Box
                        sx={{
                            textAlign: "center",
                            fontFamily: "monospace",
                            color: "#777",
                            fontSize: 11,
                            letterSpacing: 1,
                            mb: 2,
                        }}
                    >
                        {invoice.invoice_uuid}
                    </Box>

                    {/* Top 3-column header (issuer / buyer / meta) */}
                    <table>
                        <tbody>
                            <tr className="head-row">
                                <td style={{ width: "34%" }}>
                                    <strong>{invoice.company_name || "—"}</strong>
                                    <br />
                                    {invoice.company_address}
                                    <br />
                                    {invoice.company_id ? `OIB: ${invoice.company_id}` : ""}
                                    <br />
                                    {invoice.company_postal_code} {invoice.company_town}
                                </td>
                                <td style={{ width: "34%" }}>
                                    <strong>Kupac/Buyer</strong>
                                    <br />
                                    {invoice.buyer_name}
                                    <br />
                                    {invoice.buyer_email}
                                    <br />
                                    {invoice.buyer_company_name}
                                    <br />
                                    {invoice.buyer_oib}
                                    <br />
                                    {invoice.buyer_address}
                                    <br />
                                    {invoice.buyer_country}
                                </td>
                                <td style={{ width: "32%" }}>
                                    <strong>Podaci/Data:</strong>
                                    <br />
                                    datum/date: {fmtDate(invoice.invoice_date)}
                                    <br />
                                    vrijeme/time: {fmtTime(invoice.invoice_date)}
                                    <br />
                                    fisk. br./no.: {invoice.invoice_code || "—"}
                                    <br />
                                    plaćeno/payment: {invoice.invoice_payment_method_name || "Kartica"}
                                    <br />
                                    djelatnik/operater: {invoice.invoice_operator_name || invoice.operator_mark || "—"}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Invoice title */}
                    <Box sx={{ textAlign: "center", my: 3 }}>
                        <Typography variant="h5" fontWeight={800}>
                            {invoiceTitle}
                        </Typography>
                    </Box>

                    {/* Items */}
                    {invoiceDetailsLoading && !items.length ? (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2, justifyContent: "center" }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2">Učitavanje stavki…</Typography>
                        </Stack>
                    ) : (
                        <TableContainer className="items">
                            <Table size="small" sx={{ mt: 1 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ width: 32 }}>#</TableCell>
                                        <TableCell>Stavke/Items</TableCell>
                                        <TableCell align="right" sx={{ width: 100 }}>
                                            Cijena/Price
                                        </TableCell>
                                        <TableCell align="right" sx={{ width: 60 }}>
                                            Kol/Qty
                                        </TableCell>
                                        <TableCell align="right" sx={{ width: 110 }}>
                                            Iznos/Amount
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {items.map((it) => {
                                        const dets = details.filter((d) => d.item_uuid === it.item_uuid);
                                        return dets.map((d) => {
                                            runningIdx += 1;
                                            return (
                                                <TableRow key={d.item_details_uuid}>
                                                    <TableCell>{runningIdx}</TableCell>
                                                    <TableCell>
                                                        {it.departure_harbor_name} - {it.arrival_harbor_name} /{" "}
                                                        {d.ticket_type_name} --- {it.departure}
                                                    </TableCell>
                                                    <TableCell align="right">{fmtEUR(d.single_price)}</TableCell>
                                                    <TableCell align="right">{Number(d.quantity || 0)}</TableCell>
                                                    <TableCell align="right">{fmtEUR(d.item_amount)}</TableCell>
                                                </TableRow>
                                            );
                                        });
                                    })}
                                    {!items.length && (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                                Nema stavki.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {/* Totals — right-aligned block */}
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                        <Box sx={{ width: 320 }} className="totals">
                            <table>
                                <tbody>
                                    <tr>
                                        <td className="label">Osnovica/Tax base:</td>
                                        <td style={{ textAlign: "right" }}>
                                            {fmtEUR(invoice.invoice_vat_base)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="label">PDV/VAT (25%):</td>
                                        <td style={{ textAlign: "right" }}>
                                            {fmtEUR(invoice.invoice_vat)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="label">Lučka taksa/Port fee (6%):</td>
                                        <td style={{ textAlign: "right" }}>
                                            {fmtEUR(invoice.invoice_harbor_tax)}
                                        </td>
                                    </tr>
                                    <tr className="total">
                                        <td>Ukupno/Total:</td>
                                        <td style={{ textAlign: "right" }}>
                                            {fmtEUR(invoice.invoice_amount)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Footer remarks */}
                    <Box sx={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                        U cijenu je uračunato 6% naknade za lučku taksu. / The price includes 6% of the port tax fee.
                        <br />
                        Lučke takse u cijeni su prolazne stavke. Oslobođeno PDV-a prema čl. 33 st.3 zakona i PDV-u. /
                        <br />
                        Port taxes in the price are a passing item. Exempt from VAT according to Art. 33 paragraph 3 of the Law on VAT.
                    </Box>
                </Paper>
            </Box>

            <Box
                sx={{
                    px: 3,
                    py: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                }}
            >
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                        variant="contained"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={onDownload}
                    >
                        Preuzmi PDF
                    </Button>
                </Stack>
            </Box>
        </Box>
    );
}
