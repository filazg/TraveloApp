import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Drawer,
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
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import { fetchPartnerInvoiceDetailsThunk, financeSliceData } from "../../financeSlice";
import PartnerInvoiceDetailsDrawer from "./PartnerInvoiceDetailsDrawer";

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
        issued: { label: "Izdano", color: "primary" },
        canceled: { label: "Stornirano", color: "error" },
    };
    const cfg = map[s] || { label: s || "—", color: "default" };
    return <Chip size="small" label={cfg.label} color={cfg.color} />;
};

// Isti izgled kao ostali računi u sustavu — dokument na bijelom listu, a ne
// popis brojki: partnerski račun je račun kao i svaki drugi i tako se čita.
const DocStyles = {
    fontFamily: `'Arial', 'Helvetica', sans-serif`,
    color: "#1a1a1a",
    "& table": { width: "100%", borderCollapse: "collapse" },
    "& td, & th": { verticalAlign: "top", padding: "4px 6px" },
    "& .head-row td": { fontSize: 13, lineHeight: 1.4 },
    "& .items th": { fontSize: 12, fontWeight: 700, borderBottom: "1px solid #bbb", textAlign: "left" },
    "& .items td": { fontSize: 12, borderBottom: "1px dotted #e5e5e5" },
    "& .totals td": { fontSize: 13 },
    "& .totals .label": { color: "#555" },
    "& .totals .total td": { fontSize: 14, fontWeight: 800, borderTop: "1px solid #999", paddingTop: 6 },
};

export default function PartnerInvoicePreviewDrawer({ invoice: invoiceFromList, onClose }) {
    const dispatch = useDispatch();
    const { partnerInvoiceDetails, partnerInvoiceDetailsLoading } = useSelector(financeSliceData);
    const [detaljiOtvoreni, setDetaljiOtvoreni] = useState(false);

    useEffect(() => {
        if (invoiceFromList?.partner_invoice_uuid) {
            dispatch(fetchPartnerInvoiceDetailsThunk(invoiceFromList.partner_invoice_uuid));
        }
    }, [dispatch, invoiceFromList?.partner_invoice_uuid]);

    if (!invoiceFromList) return null;

    // Popis vraća sažetak, detalji cijeli zapis — uzima se detaljni kad stigne.
    const head = partnerInvoiceDetails?.invoice || invoiceFromList;
    const items = partnerInvoiceDetails?.items || [];

    const naslov = head.fiskal_required
        ? `F2 Račun/Invoice ${head.partner_invoice_no}/${head.invoice_year}`
        : `Račun/Invoice ${head.partner_invoice_no}/${head.invoice_year}`;

    return (
        <Box sx={{ width: { xs: "100vw", sm: 780 }, height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Traka iznad dokumenta — nije dio ispisa */}
            <Box sx={{ px: 3, py: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={800}>
                            Partner račun #{head.partner_invoice_no}/{head.invoice_year}
                        </Typography>
                        {statusBadge(head.status)}
                    </Stack>
                    <Button size="small" onClick={onClose} startIcon={<CloseIcon />}>
                        Zatvori
                    </Button>
                </Stack>
            </Box>

            <Box sx={{ flex: 1, overflow: "auto", bgcolor: "#f2f2f2", py: 3 }}>
                <Paper elevation={2} sx={{ mx: "auto", maxWidth: 720, p: 5, bgcolor: "#ffffff", ...DocStyles }}>
                    <Box sx={{ textAlign: "center", fontFamily: "monospace", color: "#777", fontSize: 11, letterSpacing: 1, mb: 2 }}>
                        {head.partner_invoice_uuid}
                    </Box>

                    <table>
                        <tbody>
                            <tr className="head-row">
                                <td style={{ width: "34%" }}>
                                    <strong>{head.company_name || "—"}</strong>
                                    <br />
                                    {head.company_address}
                                    <br />
                                    {head.company_legal_id ? `OIB: ${head.company_legal_id}` : ""}
                                    <br />
                                    {head.company_postal_code} {head.company_town}
                                </td>
                                <td style={{ width: "34%" }}>
                                    <strong>Kupac/Buyer</strong>
                                    <br />
                                    {head.partner_name}
                                    <br />
                                    {head.partner_legal_id ? `OIB: ${head.partner_legal_id}` : ""}
                                    <br />
                                    {head.partner_vat_id && head.partner_vat_id !== head.partner_legal_id
                                        ? `VAT: ${head.partner_vat_id}`
                                        : ""}
                                    <br />
                                    {head.partner_address}
                                    <br />
                                    {[head.partner_postal_code, head.partner_town].filter(Boolean).join(" ")}
                                    <br />
                                    {head.partner_country}
                                </td>
                                <td style={{ width: "32%" }}>
                                    <strong>Podaci/Data:</strong>
                                    <br />
                                    datum/date: {fmtDate(head.invoice_date)}
                                    <br />
                                    vrijeme/time: {fmtTime(head.invoice_date)}
                                    <br />
                                    razdoblje/period: {fmtDate(head.period_from)} – {fmtDate(head.period_to)}
                                    <br />
                                    plaćanje/payment: {head.payment_method_name || "Virman"}
                                    <br />
                                    {head.company_iban ? `IBAN: ${head.company_iban}` : ""}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <Box sx={{ textAlign: "center", my: 3 }}>
                        <Typography variant="h5" fontWeight={800}>{naslov}</Typography>
                    </Box>

                    {/* Račun ima nekoliko stavaka i tako se i čita; što je točno
                        prodano stoji u razradi, iza gumba Detalji. */}
                    <TableContainer className="items">
                        <Table size="small" sx={{ mt: 1 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 32 }}>#</TableCell>
                                    <TableCell>Stavke/Items</TableCell>
                                    <TableCell align="right" sx={{ width: 70 }}>Kol/Qty</TableCell>
                                    <TableCell align="right" sx={{ width: 120 }}>Iznos/Amount</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow>
                                    <TableCell>1</TableCell>
                                    <TableCell>
                                        Prodane karte u razdoblju {fmtDate(head.period_from)} – {fmtDate(head.period_to)}
                                        <br />
                                        <span style={{ color: "#777" }}>osnovica bez lučke pristojbe i PDV-a</span>
                                    </TableCell>
                                    <TableCell align="right">{head.tickets_count}</TableCell>
                                    <TableCell align="right">{fmtEUR(head.commission_base)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>2</TableCell>
                                    <TableCell>
                                        Provizija partnera {Number(head.commission_pct || 0).toFixed(2)} %
                                        <br />
                                        <span style={{ color: "#777" }}>obračunata na osnovicu</span>
                                    </TableCell>
                                    <TableCell align="right" />
                                    <TableCell align="right">− {fmtEUR(head.commission_amount)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>3</TableCell>
                                    <TableCell>
                                        Lučka pristojba
                                        <br />
                                        <span style={{ color: "#777" }}>prolazna stavka, oslobođeno PDV-a</span>
                                    </TableCell>
                                    <TableCell align="right" />
                                    <TableCell align="right">{fmtEUR(head.harbor_tax_amount)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                        <Box sx={{ width: 340 }} className="totals">
                            <table>
                                <tbody>
                                    <tr>
                                        <td className="label">Osnovica/Tax base:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(head.vat_base)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label">PDV/VAT ({Number(head.vat_rate || 0).toFixed(0)}%):</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(head.vat_amount)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label">Lučka taksa/Port fee:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(head.harbor_tax_amount)}</td>
                                    </tr>
                                    <tr className="total">
                                        <td>Ukupno/Total:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(head.net_amount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Koliko je partner naplatio putniku ne stoji na računu: prodaje u
                        svoje ime i po svojoj cijeni, a mi mu fakturiramo svoju cijenu. */}
                    <Box sx={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                        Lučke takse u cijeni su prolazne stavke. Oslobođeno PDV-a prema čl. 33 st. 3 Zakona o PDV-u. /
                        <br />
                        Port taxes in the price are a passing item. Exempt from VAT according to Art. 33 paragraph 3 of the Law on VAT.
                    </Box>
                </Paper>
            </Box>

            <Box sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                    {partnerInvoiceDetailsLoading ? <CircularProgress size={18} /> : null}
                    <Button
                        variant="contained"
                        startIcon={<ListAltOutlinedIcon />}
                        onClick={() => setDetaljiOtvoreni(true)}
                        disabled={!items.length}
                    >
                        Detalji
                    </Button>
                </Stack>
            </Box>

            <Drawer
                anchor="right"
                open={detaljiOtvoreni}
                onClose={() => setDetaljiOtvoreni(false)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 860, md: 1100 }, maxWidth: "100vw" } }}
            >
                <PartnerInvoiceDetailsDrawer
                    invoice={head}
                    items={items}
                    onClose={() => setDetaljiOtvoreni(false)}
                />
            </Drawer>
        </Box>
    );
}
