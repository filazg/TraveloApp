import { Fragment, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    fetchDailyRealizationThunk,
    fetchDailyRealizationDemoThunk,
    financeSliceData,
    sendDailyRealizationToErpThunk,
    sendDailyRealizationDemoToErpThunk,
    setDailyRealizationFilter,
    setDailyRealizationDemoFilter,
    clearDailyRealizationSendResult,
    clearDailyRealizationDemoSendResult,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

export default function DailyRealizationPage({ demo = false }) {
    const dispatch = useDispatch();
    const f = useSelector(financeSliceData);
    const [expandedDays, setExpandedDays] = useState(new Set());
    const [showJournal, setShowJournal] = useState({});

    const data = demo ? f.dailyRealizationDemo : f.dailyRealization;
    const loading = demo ? f.dailyRealizationDemoLoading : f.dailyRealizationLoading;
    const error = demo ? f.dailyRealizationDemoError : f.dailyRealizationError;
    const filters = demo ? f.dailyRealizationDemoFilters : f.dailyRealizationFilters;
    const sendByDay = demo ? f.dailyRealizationDemoSendByDay : f.dailyRealizationSendByDay;
    const fetchThunk = demo ? fetchDailyRealizationDemoThunk : fetchDailyRealizationThunk;
    const sendThunk = demo ? sendDailyRealizationDemoToErpThunk : sendDailyRealizationToErpThunk;
    const setFilterAction = demo ? setDailyRealizationDemoFilter : setDailyRealizationFilter;
    const clearSendAction = demo ? clearDailyRealizationDemoSendResult : clearDailyRealizationSendResult;

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const load = async () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat izvještaja" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchThunk(filters));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const toggleDay = (date) => {
        setExpandedDays((s) => {
            const n = new Set(s);
            n.has(date) ? n.delete(date) : n.add(date);
            return n;
        });
    };

    const toggleJournal = (key) => {
        setShowJournal((s) => ({ ...s, [key]: !s[key] }));
    };

    const handleSendDay = async (date) => {
        dispatch(clearSendAction(date));
        await dispatch(sendThunk({ date }));
    };

    const days = data?.days || [];
    const companySaop = data?.company_saop || {};

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%" }}>
            {demo && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>DEMO izvještaj.</strong> Sintetizirani podaci — ne čita stvarne račune iz baze.
                    Služi kao primjer kako će izgledati nakon što sustav bude imao dovoljno transakcija.
                </Alert>
            )}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
                <TextField
                    type="date"
                    label="Od"
                    InputLabelProps={{ shrink: true }}
                    value={filters.from}
                    onChange={(e) =>
                        dispatch(setFilterAction({ path: "from", value: e.target.value }))
                    }
                    sx={{ width: 180 }}
                />
                <TextField
                    type="date"
                    label="Do"
                    InputLabelProps={{ shrink: true }}
                    value={filters.to}
                    onChange={(e) =>
                        dispatch(setFilterAction({ path: "to", value: e.target.value }))
                    }
                    sx={{ width: 180 }}
                />
                <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={load}
                    disabled={loading}
                    sx={{ height: 56, px: 3 }}
                >
                    Dohvati
                </Button>
            </Stack>

            {(!companySaop.organization_id || !companySaop.link_to_book) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    SAOP postavke tvrtke nisu kompletne (Organization ID / Link to Book). Otvori
                    Backoffice → Tvrtka i unesi vrijednosti.
                </Alert>
            )}

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <TableContainer component={Paper} variant="outlined">
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell width={40} />
                            <TableCell>Datum</TableCell>
                            <TableCell align="right">Računa</TableCell>
                            <TableCell align="right">Promet</TableCell>
                            <TableCell align="right">Osnovica</TableCell>
                            <TableCell align="right">PDV</TableCell>
                            <TableCell align="right">Lučka pristojba</TableCell>
                            <TableCell align="center">Cost-centri</TableCell>
                            <TableCell align="center">Status</TableCell>
                            <TableCell align="center">ERP</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {days.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={10} align="center" sx={{ color: "text.secondary", py: 4 }}>
                                    Nema podataka za odabrani period.
                                </TableCell>
                            </TableRow>
                        )}
                        {days.map((day) => {
                            const isOpen = expandedDays.has(day.date);
                            const dayTotals = (day.costCenters || []).reduce(
                                (acc, cc) => {
                                    acc.invoice_count += cc.invoice_count || 0;
                                    acc.amount += Number(cc.totals?.amount || 0);
                                    acc.vat_base += Number(cc.totals?.vat_base || 0);
                                    acc.vat += Number(cc.totals?.vat || 0);
                                    acc.harbor_tax += Number(cc.totals?.harbor_tax || 0);
                                    acc.warnings += (cc.warnings || []).length;
                                    return acc;
                                },
                                { invoice_count: 0, amount: 0, vat_base: 0, vat: 0, harbor_tax: 0, warnings: 0 },
                            );
                            const sendState = sendByDay?.[day.date] || {};
                            const sendDisabled =
                                sendState.loading || dayTotals.warnings > 0 || dayTotals.invoice_count === 0;
                            const sendTitle = dayTotals.warnings > 0
                                ? "Riješi upozorenja prije slanja"
                                : sendState.result
                                    ? sendState.result.message || "Poslano"
                                    : sendState.error || "Pošalji ovaj dan u SAOP iCenter";
                            return (
                                <Fragment key={day.date}>
                                    <TableRow
                                        hover
                                        sx={{ "& > *": { borderBottom: "unset" } }}
                                    >
                                        <TableCell onClick={() => toggleDay(day.date)} sx={{ cursor: "pointer" }}>
                                            <IconButton size="small">
                                                {isOpen ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                                            </IconButton>
                                        </TableCell>
                                        <TableCell
                                            onClick={() => toggleDay(day.date)}
                                            sx={{ fontWeight: 700, cursor: "pointer" }}
                                        >
                                            {day.date}
                                        </TableCell>
                                        <TableCell align="right">{dayTotals.invoice_count}</TableCell>
                                        <TableCell align="right">{fmtEUR(dayTotals.amount)}</TableCell>
                                        <TableCell align="right">{fmtEUR(dayTotals.vat_base)}</TableCell>
                                        <TableCell align="right">{fmtEUR(dayTotals.vat)}</TableCell>
                                        <TableCell align="right">{fmtEUR(dayTotals.harbor_tax)}</TableCell>
                                        <TableCell align="center">{day.costCenters?.length || 0}</TableCell>
                                        <TableCell align="center">
                                            {dayTotals.warnings > 0 ? (
                                                <Chip
                                                    size="small"
                                                    color="warning"
                                                    icon={<WarningAmberIcon />}
                                                    label={dayTotals.warnings}
                                                />
                                            ) : (
                                                <Chip size="small" color="success" label="OK" />
                                            )}
                                        </TableCell>
                                        <TableCell align="center" sx={{ minWidth: 160 }}>
                                            <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                                                <Tooltip title={sendTitle}>
                                                    <span>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            color={sendState.error ? "error" : "warning"}
                                                            startIcon={<SendIcon />}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSendDay(day.date);
                                                            }}
                                                            disabled={sendDisabled}
                                                        >
                                                            {sendState.loading ? "Šalje…" : "Pošalji"}
                                                        </Button>
                                                    </span>
                                                </Tooltip>
                                                {sendState.result && (
                                                    <Chip
                                                        size="small"
                                                        color={sendState.result.status === 200 ? "success" : "info"}
                                                        label={sendState.result.status === 200 ? "Poslano" : `Status ${sendState.result.status || "?"}`}
                                                    />
                                                )}
                                                {sendState.error && (
                                                    <Chip size="small" color="error" label="Greška" />
                                                )}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                    {isOpen && (
                                        <TableRow>
                                            <TableCell colSpan={10} sx={{ bgcolor: "rgba(0,0,0,0.02)", py: 2 }}>
                                                <CostCenterDetail
                                                    day={day}
                                                    showJournal={showJournal}
                                                    toggleJournal={toggleJournal}
                                                />
                                                {sendState.error && (
                                                    <Alert severity="error" sx={{ mt: 2 }}>
                                                        {sendState.error}
                                                    </Alert>
                                                )}
                                                {sendState.result && (
                                                    <Alert
                                                        severity={sendState.result.status === 200 ? "success" : "info"}
                                                        sx={{ mt: 2 }}
                                                    >
                                                        {sendState.result.message ||
                                                            sendState.result.error ||
                                                            JSON.stringify(sendState.result)}
                                                    </Alert>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}

function CostCenterDetail({ day, showJournal, toggleJournal }) {
    return (
        <Stack spacing={2}>
            {(day.costCenters || []).map((cc, idx) => {
                const journalKey = `${day.date}|${cc.cost_center || idx}`;
                const lineBreakdown = cc.lineBreakdown || [];
                const reclassifications = cc.reclassifications || [];
                return (
                    <Paper key={journalKey} variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                            <Typography fontWeight={700}>
                                Mjesto troška: {cc.cost_center || "—"}
                            </Typography>
                            {cc.billing_device_name && (
                                <Chip size="small" label={cc.billing_device_name} />
                            )}
                            <Box sx={{ flex: 1 }} />
                            <Chip size="small" label={`${cc.invoice_count} računa`} />
                            <Chip size="small" label={`Promet: ${fmtEUR(cc.totals?.amount)}`} />
                            <Button size="small" onClick={() => toggleJournal(journalKey)}>
                                {showJournal[journalKey] ? "Sakrij detalje" : "Detalji"}
                            </Button>
                        </Stack>

                        {(cc.warnings || []).map((w, i) => (
                            <Alert key={i} severity="warning" sx={{ mb: 1 }}>
                                {w}
                            </Alert>
                        ))}

                        {lineBreakdown.length > 0 && (
                            <>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Po liniji (Nositelj troška)
                                </Typography>
                                <Table size="small" sx={{ mb: 2 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Linija</TableCell>
                                            <TableCell>Nositelj troška</TableCell>
                                            <TableCell align="right">Karte</TableCell>
                                            <TableCell align="right">Osnovica</TableCell>
                                            <TableCell align="right">PDV</TableCell>
                                            <TableCell align="right">Lučka</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {lineBreakdown.map((l) => (
                                            <Fragment key={l.line_code}>
                                                <TableRow>
                                                    <TableCell>{l.line_code} — {l.line_name}</TableCell>
                                                    <TableCell>
                                                        {l.saop_cost_bearer || (
                                                            <span style={{ color: "#b91c1c" }}>nije postavljen</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">{l.item_count}</TableCell>
                                                    <TableCell align="right">{fmtEUR(l.vat_base_current)}</TableCell>
                                                    <TableCell align="right">{fmtEUR(l.vat)}</TableCell>
                                                    <TableCell align="right">{fmtEUR(l.harbor_tax)}</TableCell>
                                                </TableRow>
                                                {/* Predujam ide u vlastiti redak po budućem razdoblju — iznos
                                                    nije prihod tekućeg mjeseca pa ne pripada retku linije. */}
                                                {(l.vat_base_future || []).map((f) => (
                                                    <TableRow key={`${l.line_code}-${f.period}`}>
                                                        <TableCell colSpan={2} sx={{ pl: 4, color: "text.secondary", fontStyle: "italic" }}>
                                                            ↳ Predujam · razdoblje {f.period}
                                                        </TableCell>
                                                        <TableCell />
                                                        <TableCell align="right" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                                                            {fmtEUR(f.amount)}
                                                        </TableCell>
                                                        <TableCell colSpan={2} />
                                                    </TableRow>
                                                ))}
                                            </Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </>
                        )}

                        {reclassifications.length > 0 && (
                            <>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Reklasifikacije s predujma (karte iz ranijih mjeseci, danas iskorištene)
                                </Typography>
                                <Table size="small" sx={{ mb: 2 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Linija</TableCell>
                                            <TableCell>Nositelj troška</TableCell>
                                            <TableCell>Razdoblje računa</TableCell>
                                            <TableCell align="right">Iznos (netto)</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {reclassifications.map((r, i) => (
                                            <TableRow key={`${r.line_code}-${r.src_period}-${i}`}>
                                                <TableCell>{r.line_code} — {r.line_name}</TableCell>
                                                <TableCell>{r.saop_cost_bearer || "—"}</TableCell>
                                                <TableCell>{r.src_period}</TableCell>
                                                <TableCell align="right">{fmtEUR(r.vat_base)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </>
                        )}

                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            Po načinu plaćanja / referentu
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Način plaćanja</TableCell>
                                    <TableCell>Konto</TableCell>
                                    <TableCell>Operater SAOP ID</TableCell>
                                    <TableCell align="right">Iznos</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(cc.byPaymentClerk || []).flatMap((row) =>
                                    (row.clerks || []).map((cl, i) => (
                                        <TableRow key={`${row.payment_method_uuid}-${i}`}>
                                            <TableCell>{row.payment_method_name || "—"}</TableCell>
                                            <TableCell>
                                                {row.account_code
                                                    ? `${row.account_code}${row.account_name ? " — " + row.account_name : ""}`
                                                    : <span style={{ color: "#b91c1c" }}>nije mapiran</span>}
                                            </TableCell>
                                            <TableCell>{cl.saop_clerk_id || <span style={{ color: "#b91c1c" }}>nije postavljen</span>}</TableCell>
                                            <TableCell align="right">{fmtEUR(cl.amount)}</TableCell>
                                        </TableRow>
                                    )),
                                )}
                            </TableBody>
                        </Table>

                        {showJournal[journalKey] && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Journal entries (preview za SAOP)
                                </Typography>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Datum</TableCell>
                                            <TableCell>Konto</TableCell>
                                            <TableCell>Opis</TableCell>
                                            <TableCell align="right">Duguje</TableCell>
                                            <TableCell align="right">Potražuje</TableCell>
                                            <TableCell>Mj. troška</TableCell>
                                            <TableCell>Nositelj troška</TableCell>
                                            <TableCell>Referent</TableCell>
                                            <TableCell>Razdoblje</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(cc.journalEntries || []).map((j, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{j.JournalEntryDate}</TableCell>
                                                <TableCell>{j.Account}</TableCell>
                                                <TableCell>{j.JournalEntryDescription}</TableCell>
                                                <TableCell align="right">
                                                    {j.DebitAmountInDomesticCurrency
                                                        ? fmtEUR(j.DebitAmountInDomesticCurrency)
                                                        : "—"}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {j.CreditAmountInDomesticCurrency
                                                        ? fmtEUR(j.CreditAmountInDomesticCurrency)
                                                        : "—"}
                                                </TableCell>
                                                <TableCell>{j.Analytics?.CostCentre || ""}</TableCell>
                                                <TableCell>{j.Analytics?.CostBearer || ""}</TableCell>
                                                <TableCell>{j.Analytics?.Referent || ""}</TableCell>
                                                <TableCell>{j.Analytics?.AdvancePeriod || ""}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </Paper>
                );
            })}
        </Stack>
    );
}
