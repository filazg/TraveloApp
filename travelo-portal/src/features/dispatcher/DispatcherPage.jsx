import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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
import CancelIcon from "@mui/icons-material/Cancel";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import SearchIcon from "@mui/icons-material/Search";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import {
    cancelSailingThunk,
    changeSailingBoatThunk,
    clearActionResult,
    fetchDispBoatsThunk,
    dispatcherSliceData,
    fetchDispCategoriesThunk,
    fetchDispSailingsThunk,
    sendSailingMessageThunk,
    setDispatcherFilter,
} from "./dispatcherSlice";
import { setAuthData } from "../auth/authSlice";

// DD/MM/YYYY or YYYY-MM-DD -> YYYY-MM-DD
const toIso = (s) => {
    if (!s) return "";
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s));
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : String(s);
};

// VIP category hidden from display (same as Kapetan/POS) — kept in data.
const HIDDEN_CATEGORY_CODES = new Set(["VIP"]);

// Sailing-level status chip mapping (derived from legs by boat-service).
const SAILING_STATUS = {
    CREATED: { label: "PLANIRANO", color: "primary", variant: "outlined" },
    IN_PROGRESS: { label: "U TIJEKU", color: "warning" },
    ARIVED: { label: "ZAVRŠIO", color: "success" },
    CANCELED: { label: "OTKAZANO", color: "error" },
};

export default function DispatcherPage() {
    const dispatch = useDispatch();
    const d = useSelector(dispatcherSliceData);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);
    const [boatOpen, setBoatOpen] = useState(false);
    const [newBoatUuid, setNewBoatUuid] = useState("");
    const [boatResult, setBoatResult] = useState(null);
    const [activeSailing, setActiveSailing] = useState(null);
    const [cancelSubject, setCancelSubject] = useState("Kapetan Luka — Polazak je otkazan");
    const [cancelBody, setCancelBody] = useState("Poštovani,\n\nObavještavamo Vas da je Vaš polazak otkazan. Ispričavamo se na neugodnosti.\n\nKapetan Luka");
    const [msgSubject, setMsgSubject] = useState("Kapetan Luka — Informacija o putovanju");
    const [msgBody, setMsgBody] = useState("");

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
    }, [dispatch]);

    useEffect(() => {
        dispatch(fetchDispSailingsThunk(d.filter.travel_date));
        dispatch(fetchDispCategoriesThunk());
        dispatch(fetchDispBoatsThunk());
    }, [dispatch, d.filter.travel_date]);

    // d.sailings comes from /portal/sailing/sailings with include=legs — each item is one voyage
    // with adjacent physical legs embedded. Derive harbor sequence + delay summary for display.
    const sailings = useMemo(() => {
        return (d.sailings || []).map((s) => {
            const adjacent = (s.legs || []).slice().sort(
                (a, b) => Number(a.departure_harbor_order) - Number(b.departure_harbor_order)
            );
            const harbors = [];
            adjacent.forEach((leg, idx) => {
                if (idx === 0) {
                    harbors.push({
                        harbor_id: leg.departure_harbor_id,
                        harbor_name: leg.departure_harbor_name,
                        planned_arrival: null,
                        planned_departure: leg.departure_time || null,
                        outgoing: leg,
                        incoming: null,
                        is_first: true,
                        is_last: false,
                    });
                }
                harbors.push({
                    harbor_id: leg.arrival_harbor_id,
                    harbor_name: leg.arrival_harbor_name,
                    planned_arrival: leg.arrival ? leg.arrival.split(".").slice(3).join(".").trim() : null,
                    planned_departure: null,
                    outgoing: null,
                    incoming: leg,
                    is_first: false,
                    is_last: idx === adjacent.length - 1,
                });
            });
            for (let i = 1; i < adjacent.length; i++) {
                const nextLeg = adjacent[i];
                const idx = harbors.findIndex(
                    (h) => h.harbor_id === nextLeg.departure_harbor_id && h.incoming === adjacent[i - 1]
                );
                if (idx >= 0) {
                    harbors[idx].planned_departure = nextLeg.departure_time || null;
                    harbors[idx].outgoing = nextLeg;
                }
            }
            const delays = [];
            for (const leg of adjacent) {
                if (leg.arrival_delay_minutes > 0) delays.push({ h: leg.arrival_harbor_name, kind: "uplov", min: leg.arrival_delay_minutes });
                if (leg.departure_delay_minutes > 0) delays.push({ h: leg.departure_harbor_name, kind: "isplov", min: leg.departure_delay_minutes });
            }

            // Aggregate passenger data from bookings (per harbor × category).
            const bookings = (s.bookings || []).filter((b) => !HIDDEN_CATEGORY_CODES.has(b.category_code));
            // Use the full active-categories list (so Bicycle etc. show even with zero capacity).
            const fromCategories = (d.categories || [])
                .filter((c) => c.is_active !== false && !HIDDEN_CATEGORY_CODES.has(c.code))
                .map((c) => c.code);
            const fromBookings = [...new Set(bookings.map((b) => b.category_code))];
            const categoryCodes = fromCategories.length ? fromCategories : fromBookings;
            const harborPax = {}; // { harbor_id: { code: { board, disembark, onboard, capacity } } }
            for (const h of harbors) {
                harborPax[h.harbor_id] = {};
                for (const code of categoryCodes) {
                    harborPax[h.harbor_id][code] = { board: 0, disembark: 0, onboard: 0, capacity: 0 };
                }
            }
            for (const b of bookings) {
                const dep = harborPax[b.departure_harbor_id]?.[b.category_code];
                if (dep) {
                    dep.board += Number(b.in_count) || 0;
                    dep.onboard = Number(b.occupied) || 0;
                    dep.capacity = (Number(b.capacity_base) || 0) + (Number(b.capacity_additional) || 0);
                }
                const arr = harborPax[b.arrival_harbor_id]?.[b.category_code];
                if (arr) {
                    arr.disembark += Number(b.out_count) || 0;
                }
            }
            // Derive planned board/disembark from occupancy deltas (fallback when scans are 0).
            for (const code of categoryCodes) {
                let prev = 0;
                for (let i = 0; i < harbors.length; i++) {
                    const cur = harborPax[harbors[i].harbor_id][code];
                    cur.disembark_planned = cur.disembark;
                    cur.board_planned = cur.onboard + cur.disembark_planned - prev;
                    if (cur.board_planned < 0) cur.board_planned = 0;
                    prev = cur.onboard;
                }
            }
            // Total passengers served = sum of planned boarding across all harbors per category.
            const paxByCategory = {};
            for (const code of categoryCodes) {
                let total = 0;
                for (const h of harbors) total += harborPax[h.harbor_id][code]?.board_planned || 0;
                paxByCategory[code] = total;
            }
            const paxTotal = Object.values(paxByCategory).reduce((a, b) => a + b, 0);
            const saleStatus = s.sailing_status === "CANCELED" ? "CANCELED" : "SCHEDULED";
            return {
                key: s.uuid,
                sailing_uuid: s.uuid,
                timetable_uuid: s.timetable_uuid,
                sequence: s.sequence,
                departure_date: adjacent[0]?.departure_date || s.departure_planed || "",
                line_code: s.line_code,
                line_name: s.line_name,
                direction: s.direction,
                departure_time: s.first_departure_time || adjacent[0]?.departure_time || "",
                start_harbor: harbors[0]?.harbor_name || "",
                end_harbor: harbors[harbors.length - 1]?.harbor_name || "",
                sale_status: saleStatus,
                sailing_status: s.sailing_status,
                boat_uuid: s.boat_uuid,
                harbors,
                adjacent,
                all_route_uuids: s.all_route_uuids || adjacent.map((l) => l.uuid),
                delays,
                max_delay: delays.reduce((m, x) => Math.max(m, x.min), 0),
                categoryCodes,
                harborPax,
                paxByCategory,
                paxTotal,
            };
        });
    }, [d.sailings, d.categories]);

    const categoryLabel = (code) => d.categories.find((c) => c.code === code || c.uuid === code)?.name_hr || code;

    const handleSearch = () => {
        dispatch(fetchDispSailingsThunk(d.filter.travel_date));
    };

    const handleOpenCancel = (sailing) => {
        setActiveSailing(sailing);
        setCancelSubject("Kapetan Luka — Polazak je otkazan");
        setCancelBody("Poštovani,\n\nObavještavamo Vas da je Vaš polazak otkazan. Ispričavamo se na neugodnosti.\n\nKapetan Luka");
        setCancelOpen(true);
    };
    const handleOpenMessage = (sailing) => {
        setActiveSailing(sailing);
        setMsgSubject("Kapetan Luka — Informacija o putovanju");
        setMsgBody("");
        setMessageOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (!activeSailing) return;
        // Use all route uuids (including compound routes) so tickets for any origin/destination combo get canceled.
        const route_uuids = activeSailing.all_route_uuids || activeSailing.adjacent.map((l) => l.uuid);
        await dispatch(cancelSailingThunk({
            route_uuids,
            subject: cancelSubject,
            body: cancelBody,
            sailing: {
                line_code: activeSailing.line_code,
                line_name: activeSailing.line_name,
                departure_date: activeSailing.departure_date,
                departure_time: activeSailing.departure_time,
                start_harbor: activeSailing.start_harbor,
                end_harbor: activeSailing.end_harbor,
            },
        }));
        await dispatch(fetchDispSailingsThunk(d.filter.travel_date));
        setCancelOpen(false);
    };
    // Zamjena plovila vrijedi samo za ovaj polazak — plovidbeni red ostaje netaknut.
    const handleOpenChangeBoat = (sailing) => {
        setActiveSailing(sailing);
        setNewBoatUuid(sailing.boat_uuid || "");
        setBoatResult(null);
        setBoatOpen(true);
    };

    const handleConfirmChangeBoat = async () => {
        if (!activeSailing || !newBoatUuid) return;
        const res = await dispatch(changeSailingBoatThunk({
            departure_uuid: activeSailing.sailing_uuid,
            boat_uuid: newBoatUuid,
        }));
        const payload = res.payload || {};
        setBoatResult(payload);
        await dispatch(fetchDispSailingsThunk(d.filter.travel_date));
        // Dijalog ostaje otvoren ako ima upozorenja o prekoračenom kapacitetu.
        if (!payload?.recalc?.overbooked?.length) setBoatOpen(false);
    };

    const handleConfirmMessage = async () => {
        if (!activeSailing) return;
        const route_uuids = activeSailing.all_route_uuids || activeSailing.adjacent.map((l) => l.uuid);
        await dispatch(sendSailingMessageThunk({
            route_uuids,
            subject: msgSubject,
            body: msgBody,
            sailing: {
                line_code: activeSailing.line_code,
                line_name: activeSailing.line_name,
                departure_date: activeSailing.departure_date,
                departure_time: activeSailing.departure_time,
                start_harbor: activeSailing.start_harbor,
                end_harbor: activeSailing.end_harbor,
            },
        }));
        setMessageOpen(false);
    };

    return (
        <Box sx={{ width: "100%", maxWidth: 1400, p: 2 }}>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                <TextField
                    type="date"
                    label="Datum polaska"
                    InputLabelProps={{ shrink: true }}
                    value={d.filter.travel_date}
                    onChange={(e) => dispatch(setDispatcherFilter({ path: "travel_date", value: e.target.value }))}
                    sx={{ width: 180 }}
                />
                <Button variant="contained" startIcon={<SearchIcon />} onClick={handleSearch} disabled={d.loading}>
                    Traži
                </Button>
                <Chip label={`${sailings.length} polazaka`} />
                {d.actionResult && (
                    <Chip
                        label={
                            d.actionResult.emails_sent != null
                                ? `Poslano ${d.actionResult.emails_sent}/${d.actionResult.emails_total} poruka`
                                : "Gotovo"
                        }
                        color="success"
                        onDelete={() => dispatch(clearActionResult())}
                    />
                )}
            </Stack>

            {d.error && <Alert severity="error" sx={{ mb: 2 }}>{d.error}</Alert>}
            {!d.loading && sailings.length === 0 && (
                <Alert severity="info">Nema polazaka za odabrani datum.</Alert>
            )}

            <Stack spacing={2}>
                {sailings.map((s) => (
                    <Box
                        key={s.key}
                        sx={{
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: s.sale_status === "CANCELED" ? "error.light" : "divider",
                            borderRadius: 2,
                            p: 2,
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                            <Box>
                                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap">
                                    <Typography variant="h6" fontWeight={800}>
                                        {s.departure_time} · {s.start_harbor}
                                    </Typography>
                                    {s.direction && <Chip label={`smjer ${s.direction}`} size="small" />}
                                    {(() => {
                                        const cfg = SAILING_STATUS[s.sailing_status] || SAILING_STATUS.CREATED;
                                        return (
                                            <Chip
                                                label={cfg.label}
                                                color={cfg.color}
                                                variant={cfg.variant || "filled"}
                                                size="small"
                                                sx={{ fontWeight: 700 }}
                                            />
                                        );
                                    })()}
                                    {s.max_delay > 0 && (
                                        <Chip
                                            label={`KAŠNJENJE +${s.max_delay} min`}
                                            color="warning"
                                            size="small"
                                            sx={{ fontWeight: 700 }}
                                        />
                                    )}
                                    {s.categoryCodes.map((code) => {
                                        const n = s.paxByCategory[code];
                                        if (!n) return null;
                                        return (
                                            <Chip
                                                key={code}
                                                size="small"
                                                color="info"
                                                label={`${categoryLabel(code)}: ${n}`}
                                                sx={{ fontWeight: 700 }}
                                            />
                                        );
                                    })}
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                    {s.line_code} {s.line_name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {s.start_harbor} → {s.end_harbor}
                                </Typography>
                                {s.delays.length > 0 && (
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                                        {s.delays.map((dl, i) => (
                                            <Chip
                                                key={i}
                                                size="small"
                                                variant="outlined"
                                                color="warning"
                                                label={`${dl.h} ${dl.kind} +${dl.min}′`}
                                                sx={{ height: 20, fontSize: 11 }}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </Box>
                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<CancelIcon />}
                                    disabled={s.sale_status === "CANCELED"}
                                    onClick={() => handleOpenCancel(s)}
                                >
                                    Otkaži polazak
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<DirectionsBoatIcon />}
                                    disabled={s.sale_status === "CANCELED"}
                                    onClick={() => handleOpenChangeBoat(s)}
                                >
                                    Zamijeni brod
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<MailOutlineIcon />}
                                    onClick={() => handleOpenMessage(s)}
                                >
                                    Pošalji poruku
                                </Button>
                            </Stack>
                        </Stack>

                        <Accordion sx={{ mt: 1.5, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2">Detalji · {s.harbors.length} luka</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>#</TableCell>
                                                <TableCell>Luka</TableCell>
                                                <TableCell>Uplovljavanje</TableCell>
                                                <TableCell>Isplovljavanje</TableCell>
                                                <TableCell>Ukrcava</TableCell>
                                                <TableCell>Iskrcava</TableCell>
                                                <TableCell>Na brodu</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Napomena</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {s.harbors.map((h, idx) => {
                                                const inStatus = h.incoming?.status;
                                                const outStatus = h.outgoing?.status;
                                                const skipped = h.incoming?.arrival_canceled === true || inStatus === "CANCELED";
                                                const arrDelay = h.incoming?.arrival_delay_minutes;
                                                const depDelay = h.outgoing?.departure_delay_minutes;
                                                const notes = [h.incoming?.arrival_note, h.outgoing?.departure_note].filter(Boolean).join(" · ");
                                                // Show the LAST completed action at this harbor.
                                                // Priority: cancel > isplovio (outgoing DEPARTED or ARIVED = already gone) > ukrcavanje > uplovio
                                                let statusLabel = "PLANIRANO";
                                                let statusColor = "default";
                                                if (skipped) { statusLabel = "PRESKOČENO"; statusColor = "error"; }
                                                else if (outStatus === "CANCELED") { statusLabel = "OTKAZANO"; statusColor = "error"; }
                                                else if (outStatus === "DEPARTED" || outStatus === "ARIVED") { statusLabel = "ISPLOVIO"; statusColor = "primary"; }
                                                else if (outStatus === "BOARDING") { statusLabel = "UKRCAVANJE"; statusColor = "warning"; }
                                                else if (inStatus === "ARIVED") { statusLabel = "UPLOVIO"; statusColor = "success"; }
                                                const pax = s.harborPax?.[h.harbor_id] || {};
                                                const perCategoryRows = (field) => (
                                                    <Stack spacing={0.25}>
                                                        {s.categoryCodes.map((c) => {
                                                            const v = pax[c]?.[field] || 0;
                                                            return (
                                                                <Typography key={c} variant="caption" sx={{ lineHeight: 1.3, color: v > 0 ? "inherit" : "text.secondary" }}>
                                                                    <b>{categoryLabel(c)}:</b> {v}
                                                                </Typography>
                                                            );
                                                        })}
                                                    </Stack>
                                                );
                                                const perCategoryOnboardRows = () => (
                                                    <Stack spacing={0.25}>
                                                        {s.categoryCodes.map((c) => {
                                                            const p = pax[c] || {};
                                                            const occ = p.onboard || 0;
                                                            const cap = p.capacity || 0;
                                                            return (
                                                                <Typography key={c} variant="caption" sx={{ lineHeight: 1.3, color: occ > 0 ? "inherit" : "text.secondary" }}>
                                                                    <b>{categoryLabel(c)}:</b> {occ}{cap > 0 ? ` / ${cap}` : ""}
                                                                </Typography>
                                                            );
                                                        })}
                                                    </Stack>
                                                );
                                                return (
                                                    <TableRow key={h.harbor_id + idx} sx={{ opacity: skipped ? 0.6 : 1 }}>
                                                        <TableCell>{idx + 1}</TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ textDecoration: skipped ? "line-through" : "none", fontWeight: h.is_first || h.is_last ? 700 : 400 }}>
                                                                {h.harbor_name}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            {h.is_first ? "—" : (
                                                                <>
                                                                    {h.planned_arrival || "—"}
                                                                    {arrDelay > 0 && <Chip size="small" label={`+${arrDelay} min`} color="warning" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
                                                                </>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {h.is_last ? "—" : (
                                                                <>
                                                                    {h.planned_departure || "—"}
                                                                    {depDelay > 0 && <Chip size="small" label={`+${depDelay} min`} color="warning" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
                                                                </>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ color: "success.main" }}>
                                                            {h.is_last ? "—" : perCategoryRows("board_planned")}
                                                        </TableCell>
                                                        <TableCell sx={{ color: "error.main" }}>
                                                            {h.is_first ? "—" : perCategoryRows("disembark_planned")}
                                                        </TableCell>
                                                        <TableCell>
                                                            {h.is_last ? "—" : perCategoryOnboardRows()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip size="small" label={statusLabel} color={statusColor} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" sx={{ fontStyle: "italic" }}>
                                                                {notes || ""}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                ))}
            </Stack>

            {/* CANCEL SAILING */}
            <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Otkazivanje polaska</DialogTitle>
                <DialogContent dividers>
                    {activeSailing && (
                        <>
                            <Typography>
                                <b>{activeSailing.departure_time}</b> · {activeSailing.line_code} {activeSailing.line_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {activeSailing.start_harbor} → {activeSailing.end_harbor} · {toIso(activeSailing.departure_date)}
                            </Typography>
                            <TextField
                                fullWidth
                                label="Naslov poruke"
                                value={cancelSubject}
                                onChange={(e) => setCancelSubject(e.target.value)}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                fullWidth
                                multiline
                                minRows={5}
                                label="Tekst poruke putnicima"
                                value={cancelBody}
                                onChange={(e) => setCancelBody(e.target.value)}
                            />
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                Polazak će biti označen kao otkazan, sve karte ovog polaska dobivaju status "otkazano putovanje", a putnicima se šalje e-mail.
                            </Alert>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCancelOpen(false)} disabled={d.actionLoading}>Odustani</Button>
                    <Button variant="contained" color="error" onClick={handleConfirmCancel} disabled={d.actionLoading}>
                        Otkaži polazak
                    </Button>
                </DialogActions>
            </Dialog>

            {/* CHANGE BOAT */}
            <Dialog open={boatOpen} onClose={() => setBoatOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Zamjena plovila na polasku</DialogTitle>
                <DialogContent dividers>
                    {activeSailing && (
                        <>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                {activeSailing.line_code} · {activeSailing.departure_date} {activeSailing.departure_time} ·{" "}
                                {activeSailing.start_harbor} → {activeSailing.end_harbor}
                            </Typography>
                            <TextField
                                select
                                fullWidth
                                label="Plovilo"
                                value={newBoatUuid}
                                onChange={(e) => setNewBoatUuid(e.target.value)}
                            >
                                {(d.boats || []).map((b) => (
                                    <MenuItem key={b.uuid} value={b.uuid}>
                                        {b.name} · {b.capacity} mjesta
                                        {b.uuid === activeSailing.boat_uuid ? " (trenutno)" : ""}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Mijenja se samo ovaj polazak — plovidbeni red i ostali polasci ostaju na svom plovilu.
                                Kapaciteti polaska preuzimaju se s novog plovila.
                            </Alert>
                            {boatResult?.recalc?.overbooked?.length > 0 && (
                                <Alert severity="warning" sx={{ mt: 2 }}>
                                    Novo plovilo ima manji kapacitet od već prodanog:
                                    {boatResult.recalc.overbooked.map((o, i) => (
                                        <div key={i}>
                                            {o.leg} · {o.category}: prodano {o.occupied}, kapacitet {o.capacity_total}
                                        </div>
                                    ))}
                                </Alert>
                            )}
                            {boatResult && !boatResult?.recalc?.overbooked?.length && (
                                <Alert severity="success" sx={{ mt: 2 }}>
                                    Plovilo zamijenjeno · ažurirano polazaka: {boatResult.departures_updated ?? 0}
                                    {boatResult.recalc?.rows_updated != null
                                        ? `, kapaciteta: ${boatResult.recalc.rows_updated}`
                                        : ""}
                                </Alert>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBoatOpen(false)} disabled={d.actionLoading}>Zatvori</Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmChangeBoat}
                        disabled={d.actionLoading || !newBoatUuid || newBoatUuid === activeSailing?.boat_uuid}
                    >
                        Zamijeni
                    </Button>
                </DialogActions>
            </Dialog>

            {/* SEND MESSAGE */}
            <Dialog open={messageOpen} onClose={() => setMessageOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Slanje poruke putnicima</DialogTitle>
                <DialogContent dividers>
                    {activeSailing && (
                        <>
                            <Typography>
                                <b>{activeSailing.departure_time}</b> · {activeSailing.line_code} {activeSailing.line_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {activeSailing.start_harbor} → {activeSailing.end_harbor} · {toIso(activeSailing.departure_date)}
                            </Typography>
                            <TextField
                                fullWidth
                                label="Naslov"
                                value={msgSubject}
                                onChange={(e) => setMsgSubject(e.target.value)}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                fullWidth
                                multiline
                                minRows={5}
                                label="Tekst"
                                value={msgBody}
                                onChange={(e) => setMsgBody(e.target.value)}
                                required
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMessageOpen(false)} disabled={d.actionLoading}>Odustani</Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmMessage}
                        disabled={d.actionLoading || !msgBody.trim()}
                    >Pošalji</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
