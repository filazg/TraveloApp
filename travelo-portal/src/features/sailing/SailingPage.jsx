import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
    cancelLegThunk,
    clearSelected,
    fetchCapacityCategoriesThunk,
    fetchSailingDetailsThunk,
    fetchSailingLinesThunk,
    fetchSailingsThunk,
    sailingSliceData,
    setSailingFilter,
    startSailingThunk,
    updateLegStatusThunk,
} from "./sailingSlice";
import { setAuthData } from "../auth/authSlice";

// VIP category currently hidden from UI but kept in data.
const HIDDEN_CATEGORY_CODES = new Set(["VIP"]);

const STATUS_LABEL = {
    CREATED: "PLANIRANO",
    PREPARED: "U PRIPREMI",
    WAITING: "ČEKANJE",
    BOARDING: "UKRCAVANJE",
    DEPARTED: "ISPLOVIO",
    ARIVED: "UPLOVIO U LUKU",
    CANCELED: "OTKAZANO",
    SKIPPED: "PRESKOČENO",
    IN_PROGRESS: "U TIJEKU",
};

const STATUS_COLOR = {
    CREATED: "default",
    PREPARED: "info",
    WAITING: "info",
    BOARDING: "warning",
    DEPARTED: "primary",
    ARIVED: "success",
    CANCELED: "error",
    SKIPPED: "error",
    IN_PROGRESS: "warning",
};

const statusChip = (status) => (
    <Chip
        label={STATUS_LABEL[status] || status || "—"}
        color={STATUS_COLOR[status] || "default"}
        size="small"
        sx={{ fontWeight: 700 }}
    />
);

// Sailing-level chip (whole voyage) uses different labels — "ZAVRŠIO" when all legs done.
const SAILING_LABEL = {
    CREATED: "PLANIRANO",
    IN_PROGRESS: "U TIJEKU",
    ARIVED: "ZAVRŠIO",
    CANCELED: "OTKAZANO",
};
const SAILING_COLOR = {
    CREATED: "default",
    IN_PROGRESS: "warning",
    ARIVED: "success",
    CANCELED: "error",
};
const sailingChip = (status) => (
    <Chip
        label={SAILING_LABEL[status] || status || "—"}
        color={SAILING_COLOR[status] || "default"}
        size="small"
        sx={{ fontWeight: 700 }}
    />
);

export default function SailingPage() {
    const dispatch = useDispatch();
    const s = useSelector(sailingSliceData);
    const [startConfirmOpen, setStartConfirmOpen] = useState(false);
    const [startTarget, setStartTarget] = useState(null);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    // Delay dialog — used for ARIVED (UPLOVLJAVANJE) and DEPARTED (ISPLOVLJAVANJE)
    const [delayDialogOpen, setDelayDialogOpen] = useState(false);
    const [delayTarget, setDelayTarget] = useState(null); // { route_uuid, status, label }
    const [delayMode, setDelayMode] = useState("on_time"); // "on_time" | "delayed"
    const [delayMinutes, setDelayMinutes] = useState("");
    const [delayNote, setDelayNote] = useState("");

    useEffect(() => {
        dispatch(fetchSailingLinesThunk());
        dispatch(fetchCapacityCategoriesThunk());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const selectedLine = useMemo(
        () => s.lines.find((l) => l.uuid === s.filter.line_uuid) || null,
        [s.lines, s.filter.line_uuid]
    );

    const canSearch = !!(s.filter.line_uuid && s.filter.departure_date);

    const search = async () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat plovidbi" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchSailingsThunk({
            line_uuid: s.filter.line_uuid,
            departure_date: s.filter.departure_date,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const openSailing = async (row) => {
        if (row.sailing_status === "CREATED") {
            setStartTarget(row);
            setStartConfirmOpen(true);
            return;
        }
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat etapa plovidbe" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchSailingDetailsThunk(row.uuid));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const confirmStart = async () => {
        if (!startTarget) return;
        setStartConfirmOpen(false);
        dispatch(setAuthData({ path: "loadingMessage", value: "Započinjanje plovidbe" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(startSailingThunk(startTarget.uuid));
        await dispatch(fetchSailingDetailsThunk(startTarget.uuid));
        await dispatch(fetchSailingsThunk({
            line_uuid: s.filter.line_uuid,
            departure_date: s.filter.departure_date,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
        setStartTarget(null);
    };

    const setLegStatus = async (route_uuid, status, extra = {}) => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Promjena statusa etape" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(updateLegStatusThunk({ route_uuid, status, ...extra }));
        if (s.selected?.sailing?.uuid) {
            await dispatch(fetchSailingDetailsThunk(s.selected.sailing.uuid));
        }
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const openDelayDialog = (route_uuid, status, label) => {
        setDelayTarget({ route_uuid, status, label });
        setDelayMode("on_time");
        setDelayMinutes("");
        setDelayNote("");
        setDelayDialogOpen(true);
    };

    const confirmDelayDialog = async () => {
        if (!delayTarget) return;
        const delay_minutes = delayMode === "delayed" ? (parseInt(delayMinutes, 10) || 0) : 0;
        const note = delayNote.trim() || null;
        setDelayDialogOpen(false);
        await setLegStatus(delayTarget.route_uuid, delayTarget.status, { delay_minutes, note });
        setDelayTarget(null);
    };

    const openCancelLeg = (leg) => {
        setCancelTarget(leg);
        setCancelReason("");
        setCancelConfirmOpen(true);
    };

    const confirmCancelLeg = async () => {
        if (!cancelTarget) return;
        setCancelConfirmOpen(false);
        dispatch(setAuthData({ path: "loadingMessage", value: "Otkazivanje etape" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(cancelLegThunk({ route_uuid: cancelTarget.uuid, cancel_reason: cancelReason }));
        if (s.selected?.sailing?.uuid) {
            await dispatch(fetchSailingDetailsThunk(s.selected.sailing.uuid));
        }
        await dispatch(fetchSailingsThunk({
            line_uuid: s.filter.line_uuid,
            departure_date: s.filter.departure_date,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
        setCancelTarget(null);
    };

    const refreshSelected = async () => {
        if (!s.selected?.sailing?.uuid) return;
        dispatch(setAuthData({ path: "loadingMessage", value: "Osvježavanje kapaciteta" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchSailingDetailsThunk(s.selected.sailing.uuid));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    // --- RENDER ---

    if (s.selected?.sailing) {
        return (
            <>
                <SailingDetailView
                    selected={s.selected}
                    categories={s.categories}
                    onBack={() => dispatch(clearSelected())}
                    onLegStatus={setLegStatus}
                    onDelayPrompt={openDelayDialog}
                    onCancelLeg={openCancelLeg}
                    onRefresh={refreshSelected}
                    cancelConfirmOpen={cancelConfirmOpen}
                    cancelTarget={cancelTarget}
                    cancelReason={cancelReason}
                    setCancelReason={setCancelReason}
                    onCloseCancel={() => setCancelConfirmOpen(false)}
                    onConfirmCancel={confirmCancelLeg}
                />

                {/* DELAY DIALOG */}
                <Dialog open={delayDialogOpen} onClose={() => setDelayDialogOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>
                        {delayTarget?.status === "ARIVED" ? "Uplovljavanje" : "Isplovljavanje"}
                    </DialogTitle>
                    <DialogContent>
                        {delayTarget && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {delayTarget.label}
                            </Typography>
                        )}
                        <Stack spacing={1}>
                            <Button
                                variant={delayMode === "on_time" ? "contained" : "outlined"}
                                color="success"
                                onClick={() => { setDelayMode("on_time"); setDelayMinutes(""); }}
                            >Redovno po satnici</Button>
                            <Button
                                variant={delayMode === "delayed" ? "contained" : "outlined"}
                                color="warning"
                                onClick={() => setDelayMode("delayed")}
                            >Kašnjenje</Button>
                        </Stack>
                        {delayMode === "delayed" && (
                            <TextField
                                label="Kašnjenje (min)"
                                type="number"
                                value={delayMinutes}
                                onChange={(e) => setDelayMinutes(e.target.value)}
                                fullWidth
                                sx={{ mt: 2 }}
                                inputProps={{ min: 1 }}
                                autoFocus
                            />
                        )}
                        <TextField
                            label="Napomena (opcionalno)"
                            value={delayNote}
                            onChange={(e) => setDelayNote(e.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                            sx={{ mt: 2 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDelayDialogOpen(false)}>Odustani</Button>
                        <Button
                            variant="contained"
                            onClick={confirmDelayDialog}
                            disabled={delayMode === "delayed" && !parseInt(delayMinutes, 10)}
                        >Potvrdi</Button>
                    </DialogActions>
                </Dialog>
            </>
        );
    }

    return (
        <Box sx={{ width: "100%", maxWidth: 1400, p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <DirectionsBoatIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>Kapetan</Typography>
            </Stack>

            {/* FILTER */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Autocomplete
                        options={s.lines}
                        getOptionLabel={(o) => `${o.code || o.line_code || ""} · ${o.name || o.line_name || ""}`}
                        value={selectedLine}
                        onChange={(_, v) => dispatch(setSailingFilter({ path: "line_uuid", value: v?.uuid || "" }))}
                        sx={{ width: 300 }}
                        renderInput={(params) => <TextField {...params} label="Linija" required />}
                    />
                    <TextField
                        type="date"
                        label="Datum plovidbe"
                        InputLabelProps={{ shrink: true }}
                        value={s.filter.departure_date}
                        onChange={(e) => dispatch(setSailingFilter({ path: "departure_date", value: e.target.value }))}
                        sx={{ width: 180 }}
                    />
                    <Button
                        variant="outlined"
                        onClick={() => dispatch(setSailingFilter({ path: "departure_date", value: new Date().toISOString().slice(0, 10) }))}
                    >DANAS</Button>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        disabled={!canSearch}
                        onClick={search}
                    >Traži</Button>
                </Stack>
            </Paper>

            {s.error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch({ type: "sailing/clearError" })}>{s.error}</Alert>}

            {/* SAILING LIST */}
            <Stack spacing={1.5}>
                {s.sailings.length === 0 && (
                    <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
                        <Typography color="text.secondary">Nema pronađenih plovidbi.</Typography>
                    </Paper>
                )}
                {s.sailings.map((row) => (
                    <Paper
                        key={row.uuid}
                        variant="outlined"
                        onClick={() => openSailing(row)}
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            cursor: row.sailing_status === "CANCELED" ? "default" : "pointer",
                            opacity: row.sailing_status === "CANCELED" ? 0.6 : 1,
                            "&:hover": row.sailing_status !== "CANCELED" ? { borderColor: "primary.main", boxShadow: 2 } : {},
                            transition: "all .15s",
                        }}
                    >
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Box sx={{ flex: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography fontWeight={700} fontSize={16}>
                                        {row.line_code} · {row.line_name}
                                    </Typography>
                                    {sailingChip(row.sailing_status)}
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Iz: <b>{row.departure_harbor_name}</b> · planirani polazak: <b>{row.first_departure_time || row.departure_planed || "—"}</b>
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Etapa: {row.legs_total}
                                    {row.legs_canceled > 0 && ` · otkazanih: ${row.legs_canceled}`}
                                    {row.boat_uuid && ` · brod: ${row.boat_uuid.slice(0, 8)}`}
                                </Typography>
                            </Box>
                            {row.sailing_status === "CREATED" && (
                                <Button variant="contained" color="success" startIcon={<PlayArrowIcon />}>
                                    Započni
                                </Button>
                            )}
                        </Stack>
                    </Paper>
                ))}
            </Stack>

            {/* START CONFIRM */}
            <Dialog open={startConfirmOpen} onClose={() => setStartConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Započinjanje plovidbe</DialogTitle>
                <DialogContent>
                    <Typography>Želite li zapečatiti plovidbu i postaviti sve etape u status "U PRIPREMI"?</Typography>
                    {startTarget && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {startTarget.line_code} · {startTarget.first_departure_time}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStartConfirmOpen(false)}>Odustani</Button>
                    <Button variant="contained" color="success" onClick={confirmStart}>Započni</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function SailingDetailView({
    selected, categories, onBack, onLegStatus, onDelayPrompt, onCancelLeg, onRefresh,
    cancelConfirmOpen, cancelTarget, cancelReason, setCancelReason, onCloseCancel, onConfirmCancel,
}) {
    const { sailing, harbors = [], legs = [], bookings = [] } = selected;

    const categoryLabel = (code) => categories.find((c) => c.code === code || c.uuid === code)?.name_hr || code;

    // Prefer the full active categories list from configuration (so all categories show even with zero tickets).
    // Fall back to whatever categories appear in bookings.
    const categoryCodes = useMemo(() => {
        if (categories && categories.length) {
            return categories
                .filter((c) => c.is_active !== false && !HIDDEN_CATEGORY_CODES.has(c.code))
                .map((c) => c.code);
        }
        const set = new Set();
        for (const b of bookings) {
            const code = b.category_code || b.category_uuid;
            if (!HIDDEN_CATEGORY_CODES.has(code)) set.add(code);
        }
        return [...set];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories, bookings]);

    // For each harbor in sequence, compute per-category board/disembark/onboard counts.
    // A booking row represents one adjacent physical leg. Its `departure_harbor_id` = leg start; `arrival_harbor_id` = leg end.
    //   - boarding at H = in_count of booking whose departure_harbor_id == H (leg starting from H, just-boarded passengers)
    //   - disembarking at H = out_count of booking whose arrival_harbor_id == H (leg ending at H)
    //   - on-board leaving H = occupied of booking whose departure_harbor_id == H
    //   - capacity at H = capacity_base + capacity_additional of that same booking (leg starting from H)
    const harborStats = useMemo(() => {
        const stats = {};
        for (const h of harbors) {
            stats[h.harbor_id] = {};
            for (const code of categoryCodes) {
                stats[h.harbor_id][code] = {
                    board_planned: 0, board_scanned: 0,
                    disembark_planned: 0, disembark_scanned: 0,
                    onboard: 0, capacity: 0, validated: 0,
                };
            }
        }
        for (const b of bookings) {
            const code = b.category_code || b.category_uuid;
            // leg starting from departure_harbor_id
            const depStats = stats[b.departure_harbor_id]?.[code];
            if (depStats) {
                depStats.board_scanned += Number(b.in_count) || 0;
                depStats.onboard = Number(b.occupied) || 0;
                depStats.capacity = (Number(b.capacity_base) || 0) + (Number(b.capacity_additional) || 0);
                depStats.validated += Number(b.validated) || 0;
            }
            // leg ending at arrival_harbor_id
            const arrStats = stats[b.arrival_harbor_id]?.[code];
            if (arrStats) {
                arrStats.disembark_scanned += Number(b.out_count) || 0;
            }
        }
        // Derive planned boarding/disembarking from running occupancy deltas.
        //   onboard(H) = onboard(prev) + board_planned(H) - disembark_planned(H)
        //   We only know onboard and disembark_scanned; approximate planned as scanned for now
        //   (exact planned would require joining tickets, which we can add later).
        for (const code of categoryCodes) {
            let prevOnboard = 0;
            for (let i = 0; i < harbors.length; i++) {
                const cur = stats[harbors[i].harbor_id][code];
                const onboard = cur.onboard;
                // planned disembark at this harbor approximated by scanned (or prev - onboard delta)
                cur.disembark_planned = cur.disembark_scanned;
                cur.board_planned = onboard + cur.disembark_planned - prevOnboard;
                if (cur.board_planned < 0) cur.board_planned = 0;
                prevOnboard = onboard;
            }
        }
        return stats;
    }, [harbors, bookings, categoryCodes]);

    // Map from harbor pair → adjacent leg (used for per-harbor incoming/outgoing status).
    const legBetween = (fromHarborId, toHarborId) =>
        legs.find((l) => l.departure_harbor_id === fromHarborId && l.arrival_harbor_id === toHarborId);

    const timeFromPlanned = (s) => {
        if (!s) return "—";
        const parts = String(s).split(".");
        return parts.length >= 4 ? parts.slice(3).join(".").trim() : s;
    };

    // Harbor-level status = last completed action at this harbor.
    // Priority: skip (arrival_canceled) > cancel > isplovio (outgoing DEPARTED/ARIVED = ship already gone) > ukrcavanje > uplovio.
    const harborStatus = (incoming, outgoing) => {
        if (incoming?.arrival_canceled) return "SKIPPED";
        const inStatus = incoming?.status;
        const outStatus = outgoing?.status;
        if (inStatus === "CANCELED") return "SKIPPED";
        if (outStatus === "CANCELED") return "CANCELED";
        if (outStatus === "DEPARTED" || outStatus === "ARIVED") return "DEPARTED";
        if (outStatus === "BOARDING") return "BOARDING";
        if (inStatus === "ARIVED") return "ARIVED";
        return "CREATED";
    };

    // Compute "next arrivable harbor" — the one where UPLOVLJAVANJE is valid.
    // Rule: only the FIRST non-skipped harbor after the last harbor from which the ship
    // has DEPARTED (ship is currently sailing toward this one).
    const nextArrivableHarborId = useMemo(() => {
        if (!harbors.length || !legs.length) return null;
        // Decorate each harbor with incoming/outgoing leg lookups.
        const decorated = harbors.map((h, i) => {
            const prev = harbors[i - 1];
            const next = harbors[i + 1];
            return {
                harbor_id: h.harbor_id,
                incoming: prev ? legs.find((l) => l.departure_harbor_id === prev.harbor_id && l.arrival_harbor_id === h.harbor_id) : null,
                outgoing: next ? legs.find((l) => l.departure_harbor_id === h.harbor_id && l.arrival_harbor_id === next.harbor_id) : null,
            };
        });
        const active = decorated.filter((d, i) => i === 0 || !(d.incoming?.arrival_canceled === true));
        let lastDepartedIdx = -1;
        for (let i = 0; i < active.length; i++) {
            if (active[i].outgoing?.status === "DEPARTED") lastDepartedIdx = i;
        }
        if (lastDepartedIdx < 0) return null;
        for (let i = lastDepartedIdx + 1; i < active.length; i++) {
            const inS = active[i].incoming?.status;
            if (inS === "ARIVED" || inS === "CANCELED") continue;
            return active[i].harbor_id;
        }
        return null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [harbors, legs]);

    return (
        <Box sx={{ width: "100%", maxWidth: 1400, p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
                <DirectionsBoatIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>
                    {sailing.line_code} · {sailing.line_name}
                </Typography>
                {sailingChip(sailing.sailing_status)}
                <Box sx={{ flex: 1 }} />
                <Button startIcon={<RefreshIcon />} onClick={onRefresh}>Osvježi</Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Polazak: <b>{sailing.departure_planed || "—"}</b> · smjer: <b>{sailing.direction}</b>
                {sailing.boat_uuid && ` · brod: ${sailing.boat_uuid.slice(0, 8)}`}
            </Typography>

            <Stack spacing={1.5}>
                {harbors.map((h, idx) => {
                    const prev = harbors[idx - 1];
                    const next = harbors[idx + 1];
                    const incomingLeg = prev ? legBetween(prev.harbor_id, h.harbor_id) : null;
                    const outgoingLeg = next ? legBetween(h.harbor_id, next.harbor_id) : null;
                    const inStatus = incomingLeg?.status || "CREATED";
                    const outStatus = outgoingLeg?.status || "CREATED";
                    const hStatus = harborStatus(incomingLeg, outgoingLeg);
                    const isSkipped = hStatus === "SKIPPED";

                    const POST_BOARDING_STATUSES = new Set(["BOARDING", "DEPARTED", "ARIVED", "CANCELED"]);
                    // UPLOVLJAVANJE: only at the "next arrivable" harbor (enforced ship-position rule).
                    const canArrive = !!incomingLeg
                        && !isSkipped
                        && inStatus !== "ARIVED"
                        && h.harbor_id === nextArrivableHarborId;
                    const canCancelArrive = !!incomingLeg
                        && !isSkipped
                        && inStatus !== "ARIVED";
                    // Boarding at this harbor requires the ship to have arrived (or be first harbor),
                    // and no later state to have already been triggered on the outgoing leg.
                    const canBoard = !!outgoingLeg
                        && !isSkipped
                        && !POST_BOARDING_STATUSES.has(outStatus)
                        && (!incomingLeg || inStatus === "ARIVED");
                    const canDepart = !!outgoingLeg && !isSkipped && outStatus === "BOARDING";

                    return (
                        <Paper
                            key={h.harbor_id + idx}
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                borderWidth: 2,
                                borderColor: isSkipped ? "error.main" : h.is_first ? "success.main" : h.is_last ? "primary.main" : "divider",
                                opacity: isSkipped ? 0.7 : 1,
                            }}
                        >
                            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
                                <Box
                                    sx={{
                                        width: 40, height: 40, borderRadius: "50%",
                                        bgcolor: isSkipped ? "error.main" : h.is_first ? "success.main" : h.is_last ? "primary.main" : "grey.400",
                                        color: "white",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontWeight: 800, fontSize: 18,
                                    }}
                                >{idx + 1}</Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="h6" sx={{ textDecoration: isSkipped ? "line-through" : "none" }}>{h.harbor_name}</Typography>
                                    <Typography variant="caption" color="text.secondary" component="div">
                                        {!h.is_first && (
                                            <>
                                                Uplovljavanje: {timeFromPlanned(h.planned_arrival)}
                                                {incomingLeg?.arrival_delay_minutes > 0 && (
                                                    <Chip
                                                        label={`+${incomingLeg.arrival_delay_minutes} min`}
                                                        color="warning"
                                                        size="small"
                                                        sx={{ ml: 0.5, height: 18, fontSize: 11 }}
                                                    />
                                                )}
                                                {incomingLeg?.status === "ARIVED" && !incomingLeg.arrival_delay_minutes && (
                                                    <Chip label="na vrijeme" color="success" size="small" sx={{ ml: 0.5, height: 18, fontSize: 11 }} />
                                                )}
                                            </>
                                        )}
                                        {!h.is_first && !h.is_last && " · "}
                                        {!h.is_last && (
                                            <>
                                                Isplovljavanje: {timeFromPlanned(h.planned_departure)}
                                                {outgoingLeg?.departure_delay_minutes > 0 && (
                                                    <Chip
                                                        label={`+${outgoingLeg.departure_delay_minutes} min`}
                                                        color="warning"
                                                        size="small"
                                                        sx={{ ml: 0.5, height: 18, fontSize: 11 }}
                                                    />
                                                )}
                                                {outgoingLeg?.status === "DEPARTED" && !outgoingLeg.departure_delay_minutes && (
                                                    <Chip label="na vrijeme" color="success" size="small" sx={{ ml: 0.5, height: 18, fontSize: 11 }} />
                                                )}
                                            </>
                                        )}
                                    </Typography>
                                    {(incomingLeg?.arrival_note || outgoingLeg?.departure_note) && (
                                        <Typography variant="caption" sx={{ display: "block", mt: 0.25, fontStyle: "italic" }}>
                                            {incomingLeg?.arrival_note && `« ${incomingLeg.arrival_note} »`}
                                            {incomingLeg?.arrival_note && outgoingLeg?.departure_note && " · "}
                                            {outgoingLeg?.departure_note && `« ${outgoingLeg.departure_note} »`}
                                        </Typography>
                                    )}
                                </Box>
                                {h.is_first && <Chip label="POLAZIŠTE" color="success" size="small" />}
                                {h.is_last && <Chip label="ODREDIŠTE" color="primary" size="small" />}
                                {statusChip(hStatus)}
                            </Stack>

                            {/* ACTION BAR */}
                            {!isSkipped && (
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                                    {incomingLeg && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="success"
                                            disabled={!canArrive}
                                            onClick={() => onDelayPrompt(incomingLeg.uuid, "ARIVED", `Uplovljavanje u ${h.harbor_name} · planirano ${timeFromPlanned(h.planned_arrival)}`)}
                                        >UPLOVLJAVANJE</Button>
                                    )}
                                    {outgoingLeg && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="info"
                                            disabled={!canBoard}
                                            onClick={() => onLegStatus(outgoingLeg.uuid, "BOARDING")}
                                        >UKRCAVANJE</Button>
                                    )}
                                    {outgoingLeg && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="primary"
                                            disabled={!canDepart}
                                            onClick={() => onDelayPrompt(outgoingLeg.uuid, "DEPARTED", `Isplovljavanje iz ${h.harbor_name} · planirano ${timeFromPlanned(h.planned_departure)}`)}
                                        >ISPLOVLJAVANJE</Button>
                                    )}
                                    <Box sx={{ flex: 1 }} />
                                    {incomingLeg && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            startIcon={<CancelIcon />}
                                            disabled={!canCancelArrive}
                                            onClick={() => onCancelLeg({ ...incomingLeg, _skipHarborName: h.harbor_name })}
                                        >OTKAŽI UPLOVLJAVANJE</Button>
                                    )}
                                </Stack>
                            )}

                            {categoryCodes.length > 0 && (
                                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1.5 }}>
                                    {categoryCodes.map((code) => {
                                        const st = harborStats[h.harbor_id]?.[code] || {
                                            board_planned: 0, board_scanned: 0,
                                            disembark_planned: 0, disembark_scanned: 0,
                                            onboard: 0, capacity: 0,
                                        };
                                        return (
                                            <Paper key={code} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5, bgcolor: "grey.50" }}>
                                                <Typography fontWeight={700} fontSize={13} sx={{ mb: 0.5 }}>{categoryLabel(code)}</Typography>
                                                <Stack spacing={0.25}>
                                                    {!h.is_last && (
                                                        <RowInfo
                                                            label="Ukrcava se"
                                                            value={`${st.board_planned}`}
                                                            color="success.main"
                                                            bold
                                                        />
                                                    )}
                                                    {!h.is_first && (
                                                        <RowInfo
                                                            label="Iskrcava se"
                                                            value={`${st.disembark_planned}`}
                                                            color="error.main"
                                                            bold
                                                        />
                                                    )}
                                                    {!h.is_last && (
                                                        <RowInfo
                                                            label="Validirano"
                                                            value={`${st.validated}`}
                                                            color="primary.main"
                                                        />
                                                    )}
                                                    {!h.is_last && (
                                                        <>
                                                            <Divider sx={{ my: 0.25 }} />
                                                            <RowInfo
                                                                label="Na brodu"
                                                                value={`${st.onboard} / ${st.capacity}`}
                                                                bold
                                                            />
                                                        </>
                                                    )}
                                                </Stack>
                                            </Paper>
                                        );
                                    })}
                                </Box>
                            )}
                        </Paper>
                    );
                })}
                {harbors.length === 0 && (
                    <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
                        <Typography color="text.secondary">Nema stajališta za ovu plovidbu.</Typography>
                    </Paper>
                )}
            </Stack>

            {/* CANCEL ARRIVAL DIALOG */}
            <Dialog open={cancelConfirmOpen} onClose={onCloseCancel} maxWidth="xs" fullWidth>
                <DialogTitle>Otkazivanje uplovljavanja</DialogTitle>
                <DialogContent>
                    {cancelTarget && (
                        <Typography variant="body2" sx={{ mb: 2 }}>
                            Otkazujete uplovljavanje u luku <b>{cancelTarget._skipHarborName || cancelTarget.arrival_harbor_name}</b>.
                            Brod će preskočiti ovo stajalište i nastaviti prema sljedećoj luci. Sve karte koje počinju ili završavaju u ovoj luci se storniraju.
                        </Typography>
                    )}
                    <TextField
                        label="Razlog otkazivanja (opcionalno)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCloseCancel}>Odustani</Button>
                    <Button variant="contained" color="error" onClick={onConfirmCancel}>Otkaži uplovljavanje</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function RowInfo({ label, value, subValue, bold, color }) {
    return (
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Stack direction="row" spacing={0.75} alignItems="baseline">
                {subValue && (
                    <Typography variant="caption" color="text.secondary">{subValue}</Typography>
                )}
                <Typography variant="body2" fontWeight={bold ? 700 : 400} color={color || "text.primary"}>{value}</Typography>
            </Stack>
        </Stack>
    );
}
