import {
    Box,
    Button,
    Chip,
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

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} EUR`;
const fmtDate = (s) => {
    if (!s) return "—";
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
};
const fmtTime = (s) => {
    if (!s) return "—";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const DocStyles = {
    fontFamily: `'Arial', 'Helvetica', sans-serif`,
    color: "#1a1a1a",
    "& table": { width: "100%", borderCollapse: "collapse" },
    "& td, & th": { verticalAlign: "top", padding: "4px 6px" },
    "& .head-row td": { fontSize: 13, lineHeight: 1.4 },
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
    "& .totals td": { fontSize: 13 },
    "& .totals .label": { color: "#555" },
    "& .totals .total td": {
        fontSize: 14,
        fontWeight: 800,
        borderTop: "1px solid #999",
        paddingTop: 6,
    },
};

export default function ShiftPreviewDrawer({ shift, onClose }) {
    if (!shift) return null;

    const operaterFull =
        `${shift.operater_name || ""} ${shift.operater_surname || ""}`.trim() ||
        shift.operater_username ||
        "—";

    const isOpen = !!shift.shift_open;
    const finance = Array.isArray(shift.shift_finance) ? shift.shift_finance : [];
    const financeSum = finance.reduce((acc, f) => acc + Number(f.payment_amount || 0), 0);

    return (
        <Box sx={{ width: { xs: "100vw", sm: 780 }, height: "100%", display: "flex", flexDirection: "column" }}>
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
                            Smjena · {operaterFull}
                        </Typography>
                        <Chip
                            size="small"
                            label={isOpen ? "Otvorena" : "Zatvorena"}
                            sx={{
                                fontWeight: 700,
                                color: isOpen ? "#854d0e" : "#1b5e20",
                                backgroundColor: isOpen ? "#fef9c3" : "#c8e6c9",
                            }}
                        />
                    </Stack>
                    <Button size="small" onClick={onClose} startIcon={<CloseIcon />}>
                        Zatvori
                    </Button>
                </Stack>
            </Box>

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
                        {shift.shift_uuid}
                    </Box>

                    <table>
                        <tbody>
                            <tr className="head-row">
                                <td style={{ width: "34%" }}>
                                    <strong>{shift.client_name || "—"}</strong>
                                    <br />
                                    {shift.client_oib ? `OIB: ${shift.client_oib}` : ""}
                                    <br />
                                    <br />
                                    <strong>Poslovni prostor</strong>
                                    <br />
                                    {shift.business_premise_name || "—"}
                                    <br />
                                    {shift.business_premise_fiscal_mark
                                        ? `Oznaka: ${shift.business_premise_fiscal_mark}`
                                        : ""}
                                </td>
                                <td style={{ width: "34%" }}>
                                    <strong>Operater</strong>
                                    <br />
                                    {operaterFull}
                                    <br />
                                    {shift.operater_username ? `@${shift.operater_username}` : ""}
                                    <br />
                                    <br />
                                    <strong>Naplatni uređaj</strong>
                                    <br />
                                    {shift.billing_device_fiscal_mark || "—"}
                                </td>
                                <td style={{ width: "32%" }}>
                                    <strong>Početak</strong>
                                    <br />
                                    {fmtDate(shift.shift_start)} {fmtTime(shift.shift_start)}
                                    <br />
                                    <br />
                                    <strong>Završetak</strong>
                                    <br />
                                    {shift.shift_end
                                        ? `${fmtDate(shift.shift_end)} ${fmtTime(shift.shift_end)}`
                                        : "— u tijeku —"}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <Box sx={{ textAlign: "center", my: 3 }}>
                        <Typography variant="h5" fontWeight={800}>
                            Zaključak smjene
                        </Typography>
                    </Box>

                    <TableContainer className="items">
                        <Table size="small" sx={{ mt: 1 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Stavka</TableCell>
                                    <TableCell align="right">Vrijednost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Prvi račun u smjeni</TableCell>
                                    <TableCell align="right">{shift.shift_first_invoice || "—"}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Zadnji račun u smjeni</TableCell>
                                    <TableCell align="right">{shift.shift_last_invoice || "—"}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
                        Promet po vrsti plaćanja
                    </Typography>
                    <TableContainer className="items">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Vrsta plaćanja</TableCell>
                                    <TableCell align="right" sx={{ width: 160 }}>
                                        Iznos
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {finance.length ? (
                                    finance.map((f) => (
                                        <TableRow key={f.shift_financ_uuid}>
                                            <TableCell>{f.payment_type_name || "—"}</TableCell>
                                            <TableCell align="right">{fmtEUR(f.payment_amount)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                            {isOpen
                                                ? "Smjena je još otvorena — nema zaključka po vrsti plaćanja."
                                                : "Nema zapisa po vrsti plaćanja."}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {finance.length > 0 && (
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 800 }}>Ukupno</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                                            {fmtEUR(financeSum)}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
                        <Box sx={{ width: 320 }} className="totals">
                            <table>
                                <tbody>
                                    <tr>
                                        <td className="label">Osnovica:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(shift.shift_vat_base)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label">PDV:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(shift.shift_vat)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label">Lučka pristojba:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(shift.shift_harbor_tax)}</td>
                                    </tr>
                                    <tr className="total">
                                        <td>Promet ukupno:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(shift.shift_amount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </Box>
                    </Box>

                    {shift.remark && (
                        <>
                            <Divider sx={{ my: 3 }} />
                            <Box sx={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                                <strong>Napomena:</strong>
                                <br />
                                {shift.remark}
                            </Box>
                        </>
                    )}
                </Paper>
            </Box>
        </Box>
    );
}
