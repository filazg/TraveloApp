import { Fragment, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    IconButton,
    Paper,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SummarizeIcon from "@mui/icons-material/Summarize";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
    fetchManagementReportThunk,
    financeSliceData,
    setManagementReportMonth,
} from "../../../finance/financeSlice";
import { setAuthData } from "../../../auth/authSlice";

const formatCountCell = (bucket) => {
    if (!bucket) return "—";
    const { passengers, animals, bicycles } = bucket;
    if (!passengers && !animals && !bicycles) return "—";
    return `${passengers}/${animals}/${bicycles}`;
};

const formatAmountCell = (bucket) => {
    if (!bucket) return "—";
    const amount = Number(bucket.amount) || 0;
    if (amount === 0) return "—";
    return amount.toFixed(2);
};

export default function ManagementReportPage() {
    const dispatch = useDispatch();
    const f = useSelector(financeSliceData);
    const [expandedLines, setExpandedLines] = useState(new Set());
    const [expandedPolasci, setExpandedPolasci] = useState(new Set());
    const [expandedLegs, setExpandedLegs] = useState(new Set());
    const [viewMode, setViewMode] = useState("count"); // "count" | "amount"
    const formatCell = viewMode === "amount" ? formatAmountCell : formatCountCell;

    const month = f.managementReportMonth;

    useEffect(() => {
        const load = async () => {
            dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat izvještaja" }));
            dispatch(setAuthData({ path: "loading", value: true }));
            await dispatch(fetchManagementReportThunk(month));
            dispatch(setAuthData({ path: "loading", value: false }));
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, month]);

    const toggleLine = (code) => {
        setExpandedLines((s) => {
            const n = new Set(s);
            n.has(code) ? n.delete(code) : n.add(code);
            return n;
        });
    };
    const togglePolazak = (key) => {
        setExpandedPolasci((s) => {
            const n = new Set(s);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });
    };
    const toggleLeg = (key) => {
        setExpandedLegs((s) => {
            const n = new Set(s);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });
    };

    const days = f.managementReport?.days || 0;
    const lines = f.managementReport?.lines || [];

    const dayHeaders = useMemo(() => {
        const arr = [];
        for (let i = 1; i <= days; i++) arr.push(i);
        return arr;
    }, [days]);

    const stickyColStyle = { position: "sticky", left: 0, zIndex: 2, backgroundColor: "#fff", borderRight: "1px solid #e0e0e0" };

    return (
        <Box sx={{ width: "100%", p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <SummarizeIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>Realizacija</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>(po datumu putovanja)</Typography>
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                        type="month"
                        label="Mjesec"
                        InputLabelProps={{ shrink: true }}
                        value={month}
                        onChange={(e) => dispatch(setManagementReportMonth(e.target.value))}
                        sx={{ width: 200 }}
                    />
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={() => dispatch(fetchManagementReportThunk(month))}
                    >Osvježi</Button>
                    <ToggleButtonGroup
                        size="small"
                        value={viewMode}
                        exclusive
                        onChange={(_, v) => { if (v) setViewMode(v); }}
                    >
                        <ToggleButton value="count">Broj karata</ToggleButton>
                        <ToggleButton value="amount">Iznos (€)</ToggleButton>
                    </ToggleButtonGroup>
                    <Box sx={{ flex: 1 }} />
                    {f.managementReport && (
                        <Typography variant="body2" color="text.secondary">
                            Karata u obračunu: <b>{f.managementReport.tickets_matched ?? 0}</b>
                            &nbsp;·&nbsp; {viewMode === "amount"
                                ? <>legenda: <b>ukupan iznos u €</b></>
                                : <>legenda: <b>putnici / životinje / bicikli</b></>}
                        </Typography>
                    )}
                </Stack>
            </Paper>

            {f.managementReportError && <Alert severity="error" sx={{ mb: 2 }}>{f.managementReportError}</Alert>}
            {!f.managementReportLoading && lines.length === 0 && (
                <Alert severity="info">Nema prodanih karata za odabrani mjesec.</Alert>
            )}

            {lines.length > 0 && (
                <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <Box
                        component="table"
                        sx={{
                            borderCollapse: "collapse",
                            width: "100%",
                            minWidth: 700 + days * 60,
                            "& th, & td": {
                                border: "1px solid",
                                borderColor: "divider",
                                px: 0.25,
                                py: 0.5,
                                fontSize: 11,
                                whiteSpace: "nowrap",
                            },
                            "& thead th:not(:first-of-type)": {
                                minWidth: 44,
                            },
                            "& th": {
                                bgcolor: "grey.100",
                                fontWeight: 700,
                                textAlign: "center",
                            },
                            "& td": {
                                textAlign: "center",
                            },
                        }}
                    >
                        <thead>
                            <tr>
                                <th style={{ ...stickyColStyle, width: 300, minWidth: 300, maxWidth: 300, textAlign: "left" }}>Linija / Polazak / Etapa / Poslovnica</th>
                                {dayHeaders.map((d) => (
                                    <th key={d}>{d}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line) => {
                                const lineExpanded = expandedLines.has(line.code);
                                return (
                                    <Fragment key={line.code}>
                                        <tr style={{ backgroundColor: "#f8fafc", fontWeight: 700 }}>
                                            <td style={{ ...stickyColStyle, textAlign: "left", backgroundColor: "#f8fafc", fontWeight: 700 }}>
                                                <IconButton size="small" onClick={() => toggleLine(line.code)}>
                                                    {lineExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                                                </IconButton>
                                                <b>{line.code}</b> · {line.name}
                                            </td>
                                            {line.totals.map((b, i) => (
                                                <td key={i} style={{ fontWeight: 700 }}>{formatCell(b)}</td>
                                            ))}
                                        </tr>
                                        {lineExpanded && line.polasci.map((p) => {
                                            const pExpanded = expandedPolasci.has(p.key);
                                            return (
                                                <Fragment key={p.key}>
                                                    <tr style={{ backgroundColor: "#eef2f7" }}>
                                                        <td style={{ ...stickyColStyle, paddingLeft: 20, textAlign: "left", backgroundColor: "#eef2f7" }}>
                                                            <IconButton size="small" onClick={() => togglePolazak(p.key)}>
                                                                {pExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                                                            </IconButton>
                                                            Polazak <b>#{p.sequence}</b>
                                                            {p.departure_time ? ` · ${p.departure_time}` : ""}
                                                            {p.direction ? ` · smjer ${p.direction}` : ""}
                                                        </td>
                                                        {p.totals.map((b, i) => (
                                                            <td key={i} style={{ fontWeight: 600 }}>{formatCell(b)}</td>
                                                        ))}
                                                    </tr>
                                                    {pExpanded && p.legs.map((l) => {
                                                        const legKey = `${p.key}|${l.key}`;
                                                        const lExpanded = expandedLegs.has(legKey);
                                                        return (
                                                            <Fragment key={legKey}>
                                                                <tr>
                                                                    <td style={{ ...stickyColStyle, paddingLeft: 40, textAlign: "left" }}>
                                                                        <IconButton size="small" onClick={() => toggleLeg(legKey)}>
                                                                            {lExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                                                                        </IconButton>
                                                                        <Chip label="etapa" size="small" variant="outlined" sx={{ mr: 1, height: 18, fontSize: 10 }} />
                                                                        {l.departure_harbor_name} → {l.arrival_harbor_name}
                                                                    </td>
                                                                    {l.totals.map((b, i) => (
                                                                        <td key={i}>{formatCell(b)}</td>
                                                                    ))}
                                                                </tr>
                                                                {lExpanded && (l.premises || []).map((bp) => (
                                                                    <tr key={legKey + "|" + bp.key}>
                                                                        <td style={{ ...stickyColStyle, paddingLeft: 60, textAlign: "left", fontStyle: "italic" }}>
                                                                            <Chip label="poslovnica" size="small" variant="outlined" color="primary" sx={{ mr: 1, height: 18, fontSize: 10 }} />
                                                                            {bp.business_premise_name}
                                                                        </td>
                                                                        {bp.totals.map((b, i) => (
                                                                            <td key={i}>{formatCell(b)}</td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </Fragment>
                                                        );
                                                    })}
                                                </Fragment>
                                            );
                                        })}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </Box>
                </Box>
            )}
        </Box>
    );
}
