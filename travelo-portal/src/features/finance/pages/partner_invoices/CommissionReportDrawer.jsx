import { useState } from "react";
import {
    Box,
    Button,
    Chip,
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
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import { dohvatiDetaljeProvizije, preuzmiIzvjestajProvizijePdf } from "../../financeSlice";
import CommissionReportDetailsDrawer from "./CommissionReportDetailsDrawer";
import { pripadaRetku } from "../partner_commission/detaljiExcel";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} EUR`;
const hrDatum = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(iso || "");
};

// Isti izgled kao račun: izvještaj je dokument koji partner dobiva i po kojem
// nam ispostavlja svoj račun, pa se tako i čita.
const DocStyles = {
    fontFamily: `'Arial', 'Helvetica', sans-serif`,
    color: "#1a1a1a",
    "& table": { width: "100%", borderCollapse: "collapse" },
    "& td, & th": { verticalAlign: "top", padding: "4px 6px" },
    "& .head-row td": { fontSize: 13, lineHeight: 1.4 },
    "& .totals td": { fontSize: 13 },
    "& .totals .label": { color: "#555" },
    "& .totals .total td": { fontSize: 14, fontWeight: 800, borderTop: "1px solid #999", paddingTop: 6 },
};

export default function CommissionReportDrawer({ partner, from, to, nazivTvrtke, onClose }) {
    const [uTijeku, setUTijeku] = useState("");
    const [detaljiOtvoreni, setDetaljiOtvoreni] = useState(false);
    // Razrada se dohvaća tek na klik: popis zna imati stotine karata, a većina
    // pogleda na izvještaj ih ne treba.
    const [redci, setRedci] = useState([]);

    if (!partner) return null;

    const otvoriDetalje = async () => {
        setUTijeku("detalji");
        try {
            const svi = await dohvatiDetaljeProvizije({ partner_uuid: partner.partner_uuid, from, to });
            setRedci(svi.filter((r) => pripadaRetku(r, { scope: "company" })));
            setDetaljiOtvoreni(true);
        } finally {
            setUTijeku("");
        }
    };

    return (
        <Box sx={{ width: { xs: "100vw", sm: 820 }, height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ px: 3, py: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={800}>
                            Izvještaj za proviziju · {partner.partner_name}
                        </Typography>
                        <Chip size="small" color="primary" label={`${Number(partner.commission_pct).toFixed(2)} %`} />
                    </Stack>
                    <Button size="small" onClick={onClose} startIcon={<CloseIcon />}>
                        Zatvori
                    </Button>
                </Stack>
            </Box>

            <Box sx={{ flex: 1, overflow: "auto", bgcolor: "#f2f2f2", py: 3 }}>
                <Paper elevation={2} sx={{ mx: "auto", maxWidth: 760, p: 5, bgcolor: "#ffffff", ...DocStyles }}>
                    <table>
                        <tbody>
                            <tr className="head-row">
                                <td style={{ width: "50%" }}>
                                    <strong>Prodavatelj u naše ime</strong>
                                    <br />
                                    {partner.partner_name}
                                    <br />
                                    {partner.partner_legal_id ? `OIB: ${partner.partner_legal_id}` : ""}
                                </td>
                                <td style={{ width: "50%" }}>
                                    <strong>Podaci</strong>
                                    <br />
                                    razdoblje: {hrDatum(from)} – {hrDatum(to)}
                                    <br />
                                    prodano u ime i za račun: {nazivTvrtke || "—"}
                                    <br />
                                    provizija: {Number(partner.commission_pct).toFixed(2)} %
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <Box sx={{ textAlign: "center", my: 3 }}>
                        <Typography variant="h5" fontWeight={800}>Izvještaj za proviziju</Typography>
                        <Typography variant="body2" color="text.secondary">
                            podloga za račun koji partner ispostavlja nama
                        </Typography>
                    </Box>

                    <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Prodajno mjesto</TableCell>
                                    <TableCell>Naplatni uređaj</TableCell>
                                    <TableCell>Operater</TableCell>
                                    <TableCell align="right">Karata</TableCell>
                                    <TableCell align="right">Promet</TableCell>
                                    <TableCell align="right">Osnovica</TableCell>
                                    <TableCell align="right">Provizija</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(partner.premises || []).map((m) => (
                                    (m.rows || []).map((r, i) => (
                                        <TableRow key={`${m.business_premise_uuid}-${r.billing_device}-${r.operator}`}>
                                            {/* Naziv mjesta samo uz prvi redak, da se ne ponavlja niz stupac. */}
                                            <TableCell>{i === 0 ? m.business_premise_name : ""}</TableCell>
                                            <TableCell>{r.billing_device || "—"}</TableCell>
                                            <TableCell>{r.operator || "—"}</TableCell>
                                            <TableCell align="right">{r.tickets}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.base)}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                                        </TableRow>
                                    ))
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                        <Box sx={{ width: 340 }} className="totals">
                            <table>
                                <tbody>
                                    <tr>
                                        <td className="label">Karata:</td>
                                        <td style={{ textAlign: "right" }}>{partner.tickets}</td>
                                    </tr>
                                    <tr>
                                        <td className="label">Promet:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(partner.gross)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label">Osnovica:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(partner.base)}</td>
                                    </tr>
                                    <tr className="total">
                                        <td>Ukupno za fakturirati:</td>
                                        <td style={{ textAlign: "right" }}>{fmtEUR(partner.commission)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </Box>
                    </Box>

                    <Box sx={{ fontSize: 11, color: "#555", lineHeight: 1.5, mt: 3 }}>
                        Osnovica je promet bez lučke pristojbe i bez PDV-a. Provizija se računa na zbroj
                        osnovice, a ne po karti — zaokruživanje po karti bi na većem broju karata
                        odstupilo od iznosa koji se stvarno plaća.
                    </Box>
                </Paper>
            </Box>

            <Box sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                        variant="outlined"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() => preuzmiIzvjestajProvizijePdf({ partner_uuid: partner.partner_uuid, from, to })}
                    >
                        Izvještaj PDF
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() => preuzmiIzvjestajProvizijePdf(
                            { partner_uuid: partner.partner_uuid, from, to },
                            { detalji: true }
                        )}
                    >
                        Detalji PDF
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<ListAltOutlinedIcon />}
                        onClick={otvoriDetalje}
                        disabled={!!uTijeku}
                    >
                        {uTijeku === "detalji" ? "Priprema…" : "Detalji"}
                    </Button>
                </Stack>
            </Box>

            <Drawer
                anchor="right"
                open={detaljiOtvoreni}
                onClose={() => setDetaljiOtvoreni(false)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 900, md: 1150 }, maxWidth: "100vw" } }}
            >
                <CommissionReportDetailsDrawer
                    partner={partner}
                    from={from}
                    to={to}
                    redci={redci}
                    onClose={() => setDetaljiOtvoreni(false)}
                />
            </Drawer>
        </Box>
    );
}
