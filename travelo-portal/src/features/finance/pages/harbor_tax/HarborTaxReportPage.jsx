import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import {
    fetchHarborTaxReportThunk,
    financeSliceData,
    setHarborTaxReportFilter,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";

const MONTHS_HR = [
    "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
    "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];

const YEAR_OPTIONS = (() => {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now + 1; y >= now - 5; y--) years.push(y);
    return years;
})();

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

export default function HarborTaxReportPage() {
    const dispatch = useDispatch();
    const {
        harborTaxReport,
        harborTaxReportLoading,
        harborTaxReportError,
        harborTaxReportFilters,
    } = useSelector(financeSliceData);

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
    }, [dispatch]);

    const handleSearch = async () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Izrada izvještaja…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(
            fetchHarborTaxReportThunk({
                year: harborTaxReportFilters.year,
                month: harborTaxReportFilters.month || undefined,
            })
        );
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const regions = harborTaxReport?.by_region || [];
    const total = harborTaxReport?.total_harbor_tax || 0;

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Stack direction="row" spacing={2} sx={{ my: 2, flexWrap: "wrap" }} alignItems="center">
                <TextField
                    select
                    label="Godina"
                    value={harborTaxReportFilters.year}
                    onChange={(e) => dispatch(setHarborTaxReportFilter({ path: "year", value: Number(e.target.value) }))}
                    sx={{ width: 120 }}
                >
                    {YEAR_OPTIONS.map((y) => (
                        <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Mjesec"
                    value={harborTaxReportFilters.month}
                    onChange={(e) => dispatch(setHarborTaxReportFilter({ path: "month", value: e.target.value === "" ? "" : Number(e.target.value) }))}
                    sx={{ width: 180 }}
                >
                    <MenuItem value="">— cijela godina —</MenuItem>
                    {MONTHS_HR.map((name, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                            {String(i + 1).padStart(2, "0")} — {name}
                        </MenuItem>
                    ))}
                </TextField>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={handleSearch}
                    disabled={harborTaxReportLoading}
                    sx={{ height: 56, px: 3 }}
                >
                    Izradi izvještaj
                </Button>
                {harborTaxReport && <Chip label={`Ukupno: ${fmtEUR(total)}`} color="primary" />}
            </Stack>

            {harborTaxReportError && <Alert severity="error" sx={{ mb: 2 }}>{harborTaxReportError}</Alert>}

            {harborTaxReport && regions.length === 0 && (
                <Alert severity="info">Nema podataka za odabrano razdoblje.</Alert>
            )}

            {regions.length > 0 && (
                <Box sx={{ maxWidth: 1200 }}>
                    <TableContainer sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell><b>Lučka uprava</b></TableCell>
                                    <TableCell align="right"><b>Broj karata</b></TableCell>
                                    <TableCell align="right"><b>Iznos</b></TableCell>
                                    <TableCell align="right"><b>Udio</b></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {regions.map((r) => (
                                    <TableRow key={r.region_uuid || r.region_name}>
                                        <TableCell>{r.region_name}</TableCell>
                                        <TableCell align="right">{r.tickets}</TableCell>
                                        <TableCell align="right"><b>{fmtEUR(r.total)}</b></TableCell>
                                        <TableCell align="right">
                                            {total > 0 ? `${((r.total / total) * 100).toFixed(1)} %` : "—"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell><b>Ukupno</b></TableCell>
                                    <TableCell align="right"><b>{regions.reduce((s, r) => s + r.tickets, 0)}</b></TableCell>
                                    <TableCell align="right"><b>{fmtEUR(total)}</b></TableCell>
                                    <TableCell align="right">—</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Razrada po lukama</Typography>
                    {regions.map((r) => (
                        <Accordion key={r.region_uuid || r.region_name} defaultExpanded={regions.length <= 3}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%" }}>
                                    <Typography fontWeight={700}>{r.region_name}</Typography>
                                    <Chip size="small" label={`${r.harbors.length} luka`} />
                                    <Box sx={{ flex: 1 }} />
                                    <Typography fontWeight={700} color="primary">{fmtEUR(r.total)}</Typography>
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Luka</TableCell>
                                                <TableCell>Kod</TableCell>
                                                <TableCell align="right">Karte</TableCell>
                                                <TableCell align="right">Iznos</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {r.harbors.map((h) => (
                                                <TableRow key={h.harbor_code}>
                                                    <TableCell>{h.harbor_name}</TableCell>
                                                    <TableCell>{h.harbor_code}</TableCell>
                                                    <TableCell align="right">{h.tickets}</TableCell>
                                                    <TableCell align="right">{fmtEUR(h.total)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            )}
        </Box>
    );
}
