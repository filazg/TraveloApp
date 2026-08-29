import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    ButtonGroup,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

import {
    emailInvoiceTicketsThunk,
    fetchAddressbookThunk,
    fetchInitialPosDataThunk,
    fetchMySalesThunk,
    fetchPosBillingDevicesThunk,
    fetchPosBusinessPremisesThunk,
    fetchPosCountriesThunk,
    fetchPosHarborsThunk,
    fetchPosLinesThunk,
    fetchPosPricesThunk,
    fetchPosRoutesThunk,
    fetchPosTicketTypeMappingsThunk,
    fetchPosVoyageBookingsThunk,
    finalizePosSaleThunk,
    saveAddressbookEntryThunk,
    salesSliceData,
    setFilter,
    resetDepartureChain,
    setDeparture,
    addCartItem,
    removeCartItem,
    clearCart,
    setTerminal,
    setPaymentMethod,
    setBuyer,
    setBuyerField,
    clearBuyer,
    clearLastInvoice,
    invoicePdfUrl,
    ticketsPdfUrl,
} from "./salesSlice";
import ContactsIcon from "@mui/icons-material/Contacts";
import SaveIcon from "@mui/icons-material/Save";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import EmailIcon from "@mui/icons-material/Email";
import { Checkbox, Drawer, FormControlLabel } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { authSliceData, setAuthData } from "../auth/authSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

// Pomaknut polazak: plovidbeni red ostaje u `departure`, stvarno vrijeme je u
// `actual_departure`. Prodaja ide po stvarnom vremenu, a planirano se prikazuje
// uz oznaku da se zna zašto se razlikuje.
const samoVrijeme = (v) => {
    const m = /(\d{1,2}):(\d{2})/.exec(String(v || ""));
    return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "";
};

const jePomaknut = (r) => !!(r?.departure && r?.actual_departure && r.departure !== r.actual_departure);

const vrijemePolaska = (r) => (jePomaknut(r) ? samoVrijeme(r.actual_departure) : (r?.departure_time || ""));

// Normalize date strings ("DD/MM/YYYY" legacy and "YYYY-MM-DD" ISO) to ISO for comparison.
const toIso = (s) => {
    if (!s) return "";
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s));
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : String(s);
};

export default function SalesPage() {
    const dispatch = useDispatch();
    const sales = useSelector(salesSliceData);
    const auth = useSelector(authSliceData);
    const [buyerOpen, setBuyerOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saveToAddressbook, setSaveToAddressbook] = useState(false);
    const [pickerSearch, setPickerSearch] = useState("");
    const [qtyByType, setQtyByType] = useState({});
    const [mySalesOpen, setMySalesOpen] = useState(false);
    const today = new Date().toISOString().slice(0, 10);
    const [mySalesFrom, setMySalesFrom] = useState(today);
    const [mySalesTo, setMySalesTo] = useState(today);

    const DEFAULT_SUBJECT = "Karte za vaše putovanje";
    const DEFAULT_BODY = "Poštovani,\n\nU privitku se nalaze vaše karte i račun za putovanje.\n\nKarte ste dužni predočiti prilikom ukrcaja na brod. Karte možete isprintati u A4 formatu ili predočiti na mobilnom uređaju. Molimo da ekran bude dobro osvijetljen i čist da bi se pravilno skenirao QR kod.\n\nQR kod je jedinstven i vrijedi samo prilikom prvog skeniranja.\n\nHvala na ukazanom povjerenju i mirno more!";
    const [emailTo, setEmailTo] = useState("");
    const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
    const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
    const [emailSending, setEmailSending] = useState(false);
    const [emailStatus, setEmailStatus] = useState(null); // { severity, message }

    const operatorUuid = (auth?.loggedUserData?.uuid || auth?.loggedUserData?.user_uuid || "");

    const loadMySales = async () => {
        if (!operatorUuid) return;
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat računa…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchMySalesThunk({
            operator_uuid: operatorUuid,
            date_from: mySalesFrom,
            date_to: mySalesTo,
            limit: 500,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const openMySales = () => {
        setMySalesOpen(true);
        loadMySales();
    };

    useEffect(() => {
        const loadInitial = async () => {
            dispatch(setAuthData({ path: "loadingMessage", value: "Učitavanje podataka za prodaju" }));
            dispatch(setAuthData({ path: "loading", value: true }));
            await dispatch(fetchInitialPosDataThunk());
            dispatch(setAuthData({ path: "loading", value: false }));
        };
        loadInitial();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    // Re-fetch bookings whenever the selected voyage changes
    useEffect(() => {
        const depUuid = sales.filters.departure?.departure_uuid;
        if (depUuid && depUuid !== sales.voyageBookingsFor) {
            const load = async () => {
                dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat kapaciteta polaska" }));
                dispatch(setAuthData({ path: "loading", value: true }));
                await dispatch(fetchPosVoyageBookingsThunk(depUuid));
                dispatch(setAuthData({ path: "loading", value: false }));
            };
            load();
        }
    }, [dispatch, sales.filters.departure, sales.voyageBookingsFor]);

    const officeBpUuids = useMemo(
        () => new Set(sales.businessPremises.filter((bp) => String(bp.type || "").toUpperCase() === "URED").map((bp) => bp.uuid)),
        [sales.businessPremises]
    );
    const officeDevices = useMemo(
        () => sales.billingDevices.filter((bd) => bd.is_active && officeBpUuids.has(bd.business_premise_uuid)),
        [sales.billingDevices, officeBpUuids]
    );

    // Harbors that appear as departure on the selected line
    const harborsForLine = useMemo(() => {
        if (!sales.filters.line_code) return [];
        const codes = new Set(
            sales.routes
                .filter((r) => r.line_code === sales.filters.line_code)
                .map((r) => r.departure_harbor_id)
        );
        return sales.harbors.filter((h) => codes.has(h.code));
    }, [sales.routes, sales.harbors, sales.filters.line_code]);

    // Departures for line + date + departure harbor (unique by sequence)
    const departures = useMemo(() => {
        const { line_code, travel_date, departure_harbor_id } = sales.filters;
        if (!line_code || !travel_date || !departure_harbor_id) return [];
        const filtered = sales.routes.filter(
            (r) =>
                r.line_code === line_code &&
                r.departure_harbor_id === departure_harbor_id &&
                toIso(r.departure_date) === travel_date
        );
        const seen = new Set();
        const uniqueBySeq = [];
        for (const r of filtered) {
            const key = `${r.timetable_uuid}-${r.sequence}`;
            if (seen.has(key)) continue;
            seen.add(key);
            uniqueBySeq.push(r);
        }
        // Sortira se po stvarnom vremenu — inače bi polazak pomaknut s jutra na
        // popodne i dalje stajao na vrhu popisa.
        return uniqueBySeq.sort((a, b) => vrijemePolaska(a).localeCompare(vrijemePolaska(b)));
    }, [sales.routes, sales.filters]);

    // Arrival harbors downstream from selected departure (same timetable/seq, higher order)
    const tripArrivals = useMemo(() => {
        const dep = sales.filters.departure;
        if (!dep) return [];
        return sales.routes
            .filter(
                (r) =>
                    r.line_code === dep.line_code &&
                    r.departure_harbor_id === dep.departure_harbor_id &&
                    toIso(r.departure_date) === toIso(dep.departure_date) &&
                    r.sequence === dep.sequence &&
                    Number(r.arrival_harbor_order) > Number(dep.departure_harbor_order)
            )
            .sort((a, b) => Number(a.arrival_harbor_order) - Number(b.arrival_harbor_order));
    }, [sales.routes, sales.filters.departure]);

    const [selectedArrival, setSelectedArrival] = useState(null);
    useEffect(() => { setSelectedArrival(null); setQtyByType({}); }, [sales.filters.departure]);

    // When a new invoice pops up, prefill email form with buyer email (if any) and defaults.
    useEffect(() => {
        if (sales.lastInvoice) {
            setEmailTo(sales.buyer?.buyer_email || sales.lastInvoice.buyer_email || "");
            setEmailSubject(DEFAULT_SUBJECT);
            setEmailBody(DEFAULT_BODY);
            setEmailStatus(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sales.lastInvoice]);

    const handleSendEmail = async () => {
        if (!sales.lastInvoice || !emailTo) return;
        setEmailSending(true);
        setEmailStatus(null);
        dispatch(setAuthData({ path: "loadingMessage", value: "Slanje emaila" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        const res = await dispatch(emailInvoiceTicketsThunk({
            invoice_uuid: sales.lastInvoice.invoice_uuid,
            order_uuid: sales.lastInvoice.order_uuid,
            to: emailTo,
            subject: emailSubject || DEFAULT_SUBJECT,
            body: emailBody || DEFAULT_BODY,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
        setEmailSending(false);
        if (res.meta.requestStatus === "fulfilled") {
            setEmailStatus({ severity: "success", message: `Email poslan na ${emailTo}` });
        } else {
            setEmailStatus({ severity: "error", message: res.payload?.message || "Slanje nije uspjelo" });
        }
    };

    // Generic helper — min free per category across physical legs in a given range.
    // VIP category is temporarily hidden from display.
    const HIDDEN_CATEGORY_CODES = new Set(["VIP"]);
    const computeFreeInRange = (dOrder, aOrder) => {
        const perCategory = {};
        for (const row of sales.voyageBookings) {
            if (row.departure_harbor_order < dOrder) continue;
            if (row.arrival_harbor_order > aOrder) continue;
            if (HIDDEN_CATEGORY_CODES.has(row.category_code)) continue;
            const free = Math.max(0, (row.capacity_base + row.capacity_additional) - row.occupied);
            if (perCategory[row.category_code] == null) {
                perCategory[row.category_code] = { free, name_hr: row.category_code };
            } else {
                perCategory[row.category_code].free = Math.min(perCategory[row.category_code].free, free);
            }
        }
        return perCategory;
    };

    // Free capacity for the currently selected arrival (drives ticket +/- buttons).
    const freeByCategoryCode = useMemo(() => {
        if (!selectedArrival || !sales.voyageBookings.length) return {};
        const dOrder = Number(selectedArrival.departure_harbor_order) || 0;
        const aOrder = Number(selectedArrival.arrival_harbor_order) || 0;
        const perCategory = computeFreeInRange(dOrder, aOrder);
        const out = {};
        for (const [code, v] of Object.entries(perCategory)) out[code] = v.free;
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedArrival, sales.voyageBookings]);

    // Free capacity per arrival in TripsView (used for inline chips on each arrival button).
    const arrivalsFreeMap = useMemo(() => {
        if (!sales.voyageBookings.length) return new Map();
        const m = new Map();
        for (const a of tripArrivals) {
            const dOrder = Number(a.departure_harbor_order) || 0;
            const aOrder = Number(a.arrival_harbor_order) || 0;
            m.set(a.uuid, computeFreeInRange(dOrder, aOrder));
        }
        return m;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripArrivals, sales.voyageBookings]);

    // Category label (HR name) by code, sorted by seed order.
    const categoryLabelByCode = useMemo(() => {
        const m = new Map();
        // Use voyageBookings as source of current categories present
        for (const row of sales.voyageBookings) {
            if (!m.has(row.category_code)) m.set(row.category_code, row.category_code);
        }
        return m;
    }, [sales.voyageBookings]);

    // Map ticket_type_uuid -> category_code (via ticket_type_mappings)
    const categoryByTicketType = useMemo(() => {
        const m = new Map();
        for (const row of sales.ticketTypeMappings) m.set(row.ticket_type_uuid, row.category_code);
        return m;
    }, [sales.ticketTypeMappings]);

    // Qty already reserved in cart for the same voyage per category (pre-submit visual reservation)
    const cartReservedPerCategory = useMemo(() => {
        const out = {};
        for (const it of sales.cart) {
            const code = categoryByTicketType.get(it.ticket_type_uuid);
            if (!code) continue;
            out[code] = (out[code] || 0) + (Number(it.qty) || 0);
        }
        return out;
    }, [sales.cart, categoryByTicketType]);

    const freeForTicketType = (ticketTypeUuid) => {
        const code = categoryByTicketType.get(ticketTypeUuid);
        if (!code) return null; // unmapped — unknown free, leave unrestricted
        const serverFree = freeByCategoryCode[code];
        if (serverFree == null) return null; // no data yet
        return Math.max(0, serverFree - (cartReservedPerCategory[code] || 0));
    };

    const pricesForArrival = useMemo(() => {
        if (!selectedArrival) return [];
        // Hide prices for ticket types mapped to hidden categories (e.g. VIP)
        const visible = (p) => {
            const code = categoryByTicketType.get(p.ticket_type_uuid);
            return !code || !HIDDEN_CATEGORY_CODES.has(code);
        };
        const p1 = sales.prices.filter(
            (p) =>
                p.timetable_uuid === selectedArrival.timetable_uuid &&
                p.harbor_from_code === selectedArrival.departure_harbor_id &&
                p.harbor_to_code === selectedArrival.arrival_harbor_id &&
                p.is_active &&
                visible(p)
        );
        if (p1.length) return p1;
        return sales.prices.filter(
            (p) =>
                p.timetable_uuid === selectedArrival.timetable_uuid &&
                p.harbor_to_code === selectedArrival.departure_harbor_id &&
                p.harbor_from_code === selectedArrival.arrival_harbor_id &&
                p.is_active &&
                visible(p)
        );
    }, [selectedArrival, sales.prices, categoryByTicketType]);

    const cartTotal = useMemo(
        () => sales.cart.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0),
        [sales.cart]
    );

    const selectedBD = officeDevices.find((bd) => bd.uuid === sales.selectedTerminal);
    const paymentMethods = (selectedBD?.payment || selectedBD?.payment_methods || []).filter((pm) => pm.is_active);

    const canIssue =
        !sales.finalizing &&
        sales.cart.length > 0 &&
        sales.selectedTerminal &&
        sales.selectedPaymentMethod;

    const bumpQty = (uuid, delta) =>
        setQtyByType((q) => ({ ...q, [uuid]: Math.max(0, (q[uuid] || 0) + delta) }));

    const handleAddToCart = () => {
        if (!selectedArrival) return;
        const route = {
            route_uuid: selectedArrival.uuid,
            line_code: selectedArrival.line_code,
            line_name: selectedArrival.line_name,
            departure_harbor_id: selectedArrival.departure_harbor_id,
            departure_harbor_name: selectedArrival.departure_harbor_name,
            arrival_harbor_id: selectedArrival.arrival_harbor_id,
            arrival_harbor_name: selectedArrival.arrival_harbor_name,
            departure_planned: `${selectedArrival.departure_date} ${selectedArrival.departure_time || ""}`.trim(),
            arrival_planned: selectedArrival.actual_arrival || "",
        };
        for (const p of pricesForArrival) {
            const qty = qtyByType[p.ticket_type_uuid] || 0;
            if (!qty) continue;
            dispatch(addCartItem({
                ticket_type_uuid: p.ticket_type_uuid,
                ticket_type_name: p.ticket_type_name,
                qty,
                unit_price: Number(p.price),
                route,
            }));
        }
        setQtyByType({});
    };

    const handleIssue = async () => {
        const op = auth?.loggedUserData || {};
        dispatch(setAuthData({ path: "loadingMessage", value: "Izdavanje računa" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        const res = await dispatch(finalizePosSaleThunk({
            items: sales.cart,
            terminal_uuid: sales.selectedTerminal,
            payment_method_uuid: sales.selectedPaymentMethod,
            operator: {
                uuid: op.uuid || op.user_uuid,
                username: op.username,
                name: op.name || op.full_name,
                mark: op.mark,
                oib: op.legal_id || op.user_legal_id || op.oib,
            },
            buyer: sales.buyer,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
        if (res.meta.requestStatus === "fulfilled") {
            // Refresh booking capacity for the current voyage so free counts update.
            const depUuid = sales.filters.departure?.departure_uuid;
            if (depUuid) {
                dispatch(setAuthData({ path: "loadingMessage", value: "Osvježavanje kapaciteta" }));
                dispatch(setAuthData({ path: "loading", value: true }));
                await dispatch(fetchPosVoyageBookingsThunk(depUuid));
                dispatch(setAuthData({ path: "loading", value: false }));
            }
        }
    };

    return (
        <Box sx={{ width: "100%", maxWidth: 1400, p: 2 }}>
            {/* Pad dohvata plovidbenog reda inače izgleda kao da linija nema polazaka
                — luke ostanu prazne i nigdje ne piše zašto. */}
            {sales.routesError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Plovidbeni red nije dohvaćen — polasci i luke se ne mogu ponuditi. {sales.routesError}
                </Alert>
            )}

            {/* FILTER BAR */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Autocomplete
                        options={sales.lines}
                        getOptionLabel={(o) => `${o.code || o.line_code || ""} · ${o.name || o.line_name || ""}`}
                        value={sales.lines.find((l) => (l.code || l.line_code) === sales.filters.line_code) || null}
                        onChange={(_, v) => {
                            dispatch(setFilter({ path: "line_code", value: v?.code || v?.line_code || "" }));
                            dispatch(resetDepartureChain());
                        }}
                        sx={{ width: 260 }}
                        renderInput={(params) => <TextField {...params} label="Linija" />}
                    />
                    <TextField
                        type="date"
                        label="Datum polaska"
                        InputLabelProps={{ shrink: true }}
                        value={sales.filters.travel_date}
                        onChange={(e) => {
                            dispatch(setFilter({ path: "travel_date", value: e.target.value }));
                            dispatch(resetDepartureChain());
                        }}
                        sx={{ width: 170 }}
                    />
                    <Button variant="outlined" onClick={() => {
                        dispatch(setFilter({ path: "travel_date", value: new Date().toISOString().slice(0, 10) }));
                        dispatch(resetDepartureChain());
                    }}>DANAS</Button>
                    <TextField
                        select
                        label="Luka polaska"
                        value={sales.filters.departure_harbor_id}
                        onChange={(e) => {
                            dispatch(setFilter({ path: "departure_harbor_id", value: e.target.value }));
                            dispatch(setDeparture(null));
                        }}
                        sx={{ width: 220 }}
                        disabled={!sales.filters.line_code}
                    >
                        <MenuItem value="">—</MenuItem>
                        {harborsForLine.map((h) => (
                            <MenuItem key={h.uuid || h.code} value={h.code}>{h.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Polazak"
                        value={sales.filters.departure ? `${sales.filters.departure.timetable_uuid}-${sales.filters.departure.sequence}` : ""}
                        onChange={(e) => {
                            const dep = departures.find((d) => `${d.timetable_uuid}-${d.sequence}` === e.target.value) || null;
                            dispatch(setDeparture(dep));
                        }}
                        sx={{ width: 240 }}
                        disabled={departures.length === 0}
                    >
                        <MenuItem value="">—</MenuItem>
                        {departures.map((d) => (
                            <MenuItem key={`${d.timetable_uuid}-${d.sequence}`} value={`${d.timetable_uuid}-${d.sequence}`}>
                                {vrijemePolaska(d)} · smjer {d.direction}
                                {jePomaknut(d) && (
                                    <Chip
                                        size="small"
                                        color="warning"
                                        label={`pomaknut, po redu ${d.departure_time}`}
                                        sx={{ ml: 1, height: 18, fontSize: 10, fontWeight: 700 }}
                                    />
                                )}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Box sx={{ flex: 1 }} />
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<ReceiptLongIcon />}
                        onClick={openMySales}
                        disabled={!operatorUuid}
                    >
                        Moja prodaja
                    </Button>
                </Stack>
            </Paper>

            {/* CENTRAL: arrivals | select | cart */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 2, mb: 2 }}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minHeight: 420 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Destinacije</Typography>
                    {!sales.filters.departure && (
                        <Typography variant="body2" color="text.secondary">Odaberi polazak.</Typography>
                    )}
                    <Stack spacing={1}>
                        {tripArrivals.map((a) => {
                            const free = arrivalsFreeMap.get(a.uuid) || {};
                            const entries = Object.entries(free);
                            const isSelected = selectedArrival?.uuid === a.uuid;
                            const isCanceled = a.sale_status === "CANCELED";
                            return (
                                <Paper
                                    key={a.uuid}
                                    elevation={0}
                                    onClick={() => !isCanceled && setSelectedArrival(a)}
                                    sx={{
                                        p: 1.25,
                                        cursor: isCanceled ? "default" : "pointer",
                                        opacity: isCanceled ? 0.55 : 1,
                                        border: "1px solid",
                                        borderColor: isSelected ? "primary.main" : "divider",
                                        bgcolor: isSelected ? "primary.50" : "background.paper",
                                        "&:hover": !isCanceled && !isSelected ? { borderColor: "primary.light" } : {},
                                        borderRadius: 1.5,
                                        transition: "border-color .15s, background-color .15s",
                                    }}
                                >
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography fontWeight={700} fontSize={14} noWrap>
                                            {a.arrival_harbor_name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                                            {a.actual_arrival || "—"}
                                        </Typography>
                                    </Stack>
                                    {isCanceled && (
                                        <Chip label="OTKAZANO" color="error" size="small" sx={{ mt: 0.75, height: 20, fontSize: 11 }} />
                                    )}
                                    {!isCanceled && entries.length > 0 && (
                                        <Box
                                            sx={{
                                                mt: 0.75,
                                                display: "grid",
                                                gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                                                gap: 0.5,
                                            }}
                                        >
                                            {entries.map(([code, v]) => (
                                                <Chip
                                                    key={code}
                                                    size="small"
                                                    label={`${code} ${v.free}`}
                                                    variant="outlined"
                                                    color={v.free === 0 ? "error" : v.free <= 5 ? "warning" : "success"}
                                                    sx={{
                                                        height: 22,
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        "& .MuiChip-label": { px: 0.75 },
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    )}
                                </Paper>
                            );
                        })}
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minHeight: 420 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Tipovi karata</Typography>
                    {!selectedArrival && <Typography variant="body2" color="text.secondary">Odaberi destinaciju.</Typography>}
                    {selectedArrival && pricesForArrival.length === 0 && (
                        <Alert severity="warning">Nema cjenika za ovu relaciju.</Alert>
                    )}
                    <Stack spacing={1}>
                        {pricesForArrival.map((p) => {
                            const q = qtyByType[p.ticket_type_uuid] || 0;
                            const free = freeForTicketType(p.ticket_type_uuid);
                            const atLimit = free != null && q >= free;
                            const unmapped = !categoryByTicketType.get(p.ticket_type_uuid);
                            return (
                                <Paper key={p.uuid || p.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                        <Typography fontWeight={600}>{p.ticket_type_name}</Typography>
                                        <Typography>{fmtEUR(p.price)}</Typography>
                                    </Stack>
                                    {unmapped ? (
                                        <Typography variant="caption" color="warning.main" sx={{ display: "block", mb: 1 }}>
                                            Nije mapirano na kategoriju kapaciteta
                                        </Typography>
                                    ) : free != null ? (
                                        <Typography
                                            variant="caption"
                                            color={free === 0 ? "error.main" : free <= 5 ? "warning.main" : "text.secondary"}
                                            sx={{ display: "block", mb: 1, fontWeight: 600 }}
                                        >
                                            {free === 0 ? "RASPRODANO" : `${free} slobodno`}
                                        </Typography>
                                    ) : null}
                                    <ButtonGroup size="small" fullWidth>
                                        <Button color="error" onClick={() => bumpQty(p.ticket_type_uuid, -1)} disabled={q === 0}>
                                            <RemoveIcon fontSize="small" />
                                        </Button>
                                        <Button sx={{ minWidth: 60 }}>{q}</Button>
                                        <Button color="success" onClick={() => bumpQty(p.ticket_type_uuid, 1)} disabled={atLimit}>
                                            <AddIcon fontSize="small" />
                                        </Button>
                                    </ButtonGroup>
                                </Paper>
                            );
                        })}
                    </Stack>
                    {pricesForArrival.length > 0 && (
                        <Button
                            variant="contained"
                            fullWidth
                            sx={{ mt: 2 }}
                            onClick={handleAddToCart}
                            disabled={!Object.values(qtyByType).some((q) => q > 0)}
                        >
                            Dodaj u košaricu
                        </Button>
                    )}
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minHeight: 420 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2">Košarica</Typography>
                        {sales.cart.length > 0 && (
                            <Button size="small" color="error" onClick={() => dispatch(clearCart())}>Isprazni</Button>
                        )}
                    </Stack>
                    {sales.cart.length === 0 && (
                        <Typography variant="body2" color="text.secondary">Prazna.</Typography>
                    )}
                    <Stack spacing={0.75}>
                        {sales.cart.map((it, i) => (
                            <Paper key={i} variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" fontWeight={600} noWrap>
                                            {it.ticket_type_name} × {it.qty}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            {it.route.departure_harbor_name} → {it.route.arrival_harbor_name} · {it.route.departure_planned}
                                        </Typography>
                                    </Box>
                                    <Typography fontWeight={700}>{fmtEUR(it.qty * it.unit_price)}</Typography>
                                    <IconButton size="small" color="error" onClick={() => dispatch(removeCartItem(i))}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Paper>
                        ))}
                    </Stack>
                    {sales.cart.length > 0 && (
                        <>
                            <Divider sx={{ my: 1.5 }} />
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="h6">UKUPNO</Typography>
                                <Typography variant="h6" fontWeight={800}>{fmtEUR(cartTotal)}</Typography>
                            </Stack>
                        </>
                    )}
                </Paper>
            </Box>

            {/* BOTTOM BAR */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr auto", gap: 2, alignItems: "center" }}>
                    <TextField
                        select
                        label="Naplatni uređaj (URED)"
                        value={sales.selectedTerminal}
                        onChange={(e) => dispatch(setTerminal(e.target.value))}
                        fullWidth
                        required
                        helperText={!officeDevices.length ? "Nema uređaja u poslovnom prostoru tipa URED" : ""}
                    >
                        {officeDevices.map((bd) => (
                            <MenuItem key={bd.uuid} value={bd.uuid}>
                                {bd.name}{bd.fiscal_mark ? ` · ${bd.fiscal_mark}` : ""}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Sredstvo plaćanja"
                        value={sales.selectedPaymentMethod}
                        onChange={(e) => dispatch(setPaymentMethod(e.target.value))}
                        fullWidth
                        required
                        disabled={!sales.selectedTerminal || !paymentMethods.length}
                    >
                        {paymentMethods.map((pm) => (
                            <MenuItem key={pm.uuid} value={pm.uuid}>{pm.name}</MenuItem>
                        ))}
                    </TextField>
                    <Box sx={{ borderLeft: "3px solid", borderColor: "divider", pl: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">KUPAC (opcionalno)</Typography>
                            <Button size="small" startIcon={<PersonIcon />} onClick={() => setBuyerOpen(true)}>
                                {sales.buyer.buyer_oib || sales.buyer.buyer_name ? "Uredi" : "Dodaj R1"}
                            </Button>
                        </Stack>
                        {(sales.buyer.buyer_company_name || sales.buyer.buyer_name) ? (
                            <>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="body2" fontWeight={700}>
                                        {sales.buyer.buyer_company_name || sales.buyer.buyer_name}
                                    </Typography>
                                    {sales.buyer.f2_required && (
                                        <Chip label="F2" size="small" color="primary" sx={{ height: 18, fontWeight: 700 }} />
                                    )}
                                </Stack>
                                {sales.buyer.buyer_oib && (
                                    <Typography variant="caption" color="text.secondary">OIB: {sales.buyer.buyer_oib}</Typography>
                                )}
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                    </Box>
                    <Button
                        variant="contained"
                        size="large"
                        color="success"
                        disabled={!canIssue}
                        onClick={handleIssue}
                        sx={{ minWidth: 220, height: 72, fontSize: 18, fontWeight: 800 }}
                    >
                        Izdaj račun · {fmtEUR(cartTotal)}
                    </Button>
                </Box>
                {sales.error && <Alert severity="error" sx={{ mt: 2 }}>{sales.error}</Alert>}
            </Paper>

            {/* BUYER EDIT DIALOG */}
            <Dialog open={buyerOpen} onClose={() => setBuyerOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <span>R1 kupac</span>
                        <Button size="small" startIcon={<ContactsIcon />} onClick={() => setPickerOpen(true)}>
                            Iz adresara
                        </Button>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Naziv tvrtke" value={sales.buyer.buyer_company_name}
                            onChange={(e) => dispatch(setBuyerField({ field: "buyer_company_name", value: e.target.value }))} fullWidth />
                        <TextField label="Ime i prezime (kontakt)" value={sales.buyer.buyer_name}
                            onChange={(e) => dispatch(setBuyerField({ field: "buyer_name", value: e.target.value }))} fullWidth />
                        <TextField label="OIB" value={sales.buyer.buyer_oib}
                            onChange={(e) => dispatch(setBuyerField({ field: "buyer_oib", value: e.target.value }))} fullWidth />
                        <TextField label="Adresa" value={sales.buyer.buyer_address}
                            onChange={(e) => dispatch(setBuyerField({ field: "buyer_address", value: e.target.value }))} fullWidth />
                        <Stack direction="row" spacing={2}>
                            <TextField label="Poštanski broj" value={sales.buyer.buyer_postal_code}
                                onChange={(e) => dispatch(setBuyerField({ field: "buyer_postal_code", value: e.target.value }))} sx={{ width: 160 }} />
                            <TextField label="Grad" value={sales.buyer.buyer_town}
                                onChange={(e) => dispatch(setBuyerField({ field: "buyer_town", value: e.target.value }))} fullWidth />
                        </Stack>
                        <TextField
                            select
                            label="Država"
                            value={sales.buyer.buyer_country || ""}
                            onChange={(e) => dispatch(setBuyerField({ field: "buyer_country", value: e.target.value }))}
                            fullWidth
                        >
                            <MenuItem value="">—</MenuItem>
                            {sales.countries.map((c) => (
                                <MenuItem key={c.code} value={c.code}>
                                    {c.name_hr} ({c.code})
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField label="Email" value={sales.buyer.buyer_email}
                            onChange={(e) => dispatch(setBuyerField({ field: "buyer_email", value: e.target.value }))} fullWidth />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={!!sales.buyer.f2_required}
                                    onChange={(e) => dispatch(setBuyerField({ field: "f2_required", value: e.target.checked }))}
                                />
                            }
                            label="F2 obveznik (fiskalizacija 2.0)"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={saveToAddressbook} onChange={(e) => setSaveToAddressbook(e.target.checked)} />}
                            label={<span><SaveIcon sx={{ fontSize: 16, verticalAlign: "middle", mr: 0.5 }} />Spremi u adresar</span>}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button color="error" onClick={() => { dispatch(clearBuyer()); setBuyerOpen(false); }}>Ukloni kupca</Button>
                    <Button onClick={() => setBuyerOpen(false)}>Odustani</Button>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            if (saveToAddressbook && (sales.buyer.buyer_company_name || sales.buyer.buyer_name)) {
                                dispatch(setAuthData({ path: "loadingMessage", value: "Spremanje u adresar" }));
                                dispatch(setAuthData({ path: "loading", value: true }));
                                await dispatch(saveAddressbookEntryThunk(sales.buyer));
                                dispatch(setAuthData({ path: "loading", value: false }));
                                setSaveToAddressbook(false);
                            }
                            setBuyerOpen(false);
                        }}
                    >Spremi</Button>
                </DialogActions>
            </Dialog>

            {/* ADDRESSBOOK PICKER */}
            <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Odabir iz adresara</DialogTitle>
                <DialogContent dividers sx={{ height: 500, display: "flex", flexDirection: "column", gap: 1 }}>
                    <TextField
                        size="small"
                        placeholder="Pretraži po nazivu, OIB-u, gradu…"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        fullWidth
                    />
                    <Box sx={{ flex: 1 }}>
                        <DataGrid
                            rows={sales.addressbook.filter((e) => {
                                if (!pickerSearch) return true;
                                const q = pickerSearch.toLowerCase();
                                return [
                                    e.buyer_company_name, e.buyer_name, e.buyer_vat_id, e.buyer_legal_id,
                                    e.buyer_town, e.buyer_email,
                                ].some((v) => String(v || "").toLowerCase().includes(q));
                            })}
                            getRowId={(r) => r.id}
                            columns={[
                                { field: "buyer_company_name", headerName: "Tvrtka", flex: 2 },
                                { field: "buyer_name", headerName: "Kontakt", flex: 1.5 },
                                { field: "buyer_vat_id", headerName: "OIB", width: 130 },
                                { field: "buyer_town", headerName: "Grad", flex: 1 },
                                { field: "buyer_email", headerName: "Email", flex: 1.5 },
                            ]}
                            onRowClick={(p) => {
                                const row = p.row;
                                dispatch(setBuyer({
                                    buyer_name: row.buyer_name || "",
                                    buyer_company_name: row.buyer_company_name || "",
                                    buyer_oib: row.buyer_vat_id || row.buyer_legal_id || "",
                                    buyer_address: row.buyer_address || "",
                                    buyer_postal_code: row.buyer_postal_code || "",
                                    buyer_town: row.buyer_town || "",
                                    buyer_country: row.buyer_country || "",
                                    buyer_email: row.buyer_email || "",
                                    f2_required: !!row.f2_required,
                                }));
                                setPickerOpen(false);
                            }}
                            density="compact"
                            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                            pageSizeOptions={[10, 25, 50, 100]}
                            sx={{ "& .MuiDataGrid-row:hover": { cursor: "pointer" } }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPickerOpen(false)}>Zatvori</Button>
                </DialogActions>
            </Dialog>

            {/* SUCCESS DIALOG */}
            <Dialog open={!!sales.lastInvoice} onClose={() => dispatch(clearLastInvoice())} fullWidth maxWidth="sm">
                <DialogTitle>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CheckCircleIcon color="success" />
                        <Typography variant="h6">Račun izdan</Typography>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    {sales.lastInvoice && (
                        <Stack spacing={2}>
                            <Stack spacing={1}>
                                <Typography>Broj: <b>{sales.lastInvoice.invoice_no}/{sales.lastInvoice.invoice_year}</b></Typography>
                                {sales.lastInvoice.fiskal_required ? (
                                    <Chip label="Fiskalizacija 2.0" color="primary" size="small" sx={{ alignSelf: "flex-start" }} />
                                ) : (
                                    sales.lastInvoice.invoice_fiskal_no && (
                                        <Typography variant="body2">
                                            Fiskalni broj: <b>{sales.lastInvoice.invoice_fiskal_no}</b>
                                        </Typography>
                                    )
                                )}
                                <Typography>Iznos: <b>{fmtEUR(sales.lastInvoice.total_amount)}</b></Typography>
                                <Typography>Karata: <b>{sales.lastInvoice.tickets_count}</b></Typography>
                            </Stack>

                            <Divider />

                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="outlined"
                                    startIcon={<PictureAsPdfIcon />}
                                    onClick={() => window.open(invoicePdfUrl(sales.lastInvoice.invoice_uuid), "_blank")}
                                >Račun PDF</Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<PictureAsPdfIcon />}
                                    onClick={() => window.open(ticketsPdfUrl(sales.lastInvoice.order_uuid), "_blank")}
                                >Karte PDF</Button>
                            </Stack>

                            <Divider />

                            <Stack spacing={1.5}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <EmailIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle2">Pošalji kupcu emailom</Typography>
                                </Stack>
                                <TextField
                                    label="Email primatelja"
                                    type="email"
                                    size="small"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                    fullWidth
                                    required
                                />
                                <TextField
                                    label="Naslov"
                                    size="small"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    fullWidth
                                />
                                <TextField
                                    label="Poruka"
                                    size="small"
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={6}
                                />
                                {emailStatus && (
                                    <Alert severity={emailStatus.severity} onClose={() => setEmailStatus(null)}>
                                        {emailStatus.message}
                                    </Alert>
                                )}
                            </Stack>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<EmailIcon />}
                        onClick={handleSendEmail}
                        disabled={emailSending || !emailTo}
                    >
                        Pošalji email
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button variant="contained" color="success" onClick={() => dispatch(clearLastInvoice())}>Nastavi</Button>
                </DialogActions>
            </Dialog>

            {/* MY SALES DRAWER */}
            <Drawer
                anchor="right"
                open={mySalesOpen}
                onClose={() => setMySalesOpen(false)}
                PaperProps={{ sx: { width: { xs: "100%", md: 900 }, p: 2 } }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <ReceiptLongIcon color="primary" />
                        <Typography variant="h6">Moja prodaja</Typography>
                        <Chip label={`${sales.mySales.length} računa`} size="small" />
                    </Stack>
                    <Button onClick={() => setMySalesOpen(false)}>Zatvori</Button>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
                    <TextField
                        type="date"
                        size="small"
                        label="Od"
                        InputLabelProps={{ shrink: true }}
                        value={mySalesFrom}
                        onChange={(e) => setMySalesFrom(e.target.value)}
                        sx={{ width: 160 }}
                    />
                    <TextField
                        type="date"
                        size="small"
                        label="Do"
                        InputLabelProps={{ shrink: true }}
                        value={mySalesTo}
                        onChange={(e) => setMySalesTo(e.target.value)}
                        sx={{ width: 160 }}
                    />
                    <Button variant="contained" size="small" onClick={loadMySales}>
                        Osvježi
                    </Button>
                    <Button
                        size="small"
                        onClick={() => { setMySalesFrom(today); setMySalesTo(today); }}
                    >
                        Danas
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Stack direction="row" spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            Ukupno: <b>{fmtEUR(sales.mySales.reduce((s, r) => s + Number(r.invoice_amount || 0), 0))}</b>
                        </Typography>
                    </Stack>
                </Stack>

                <Box sx={{ height: "calc(100vh - 200px)" }}>
                    <DataGrid
                        rows={sales.mySales}
                        getRowId={(r) => r.invoice_uuid || r.id}
                        density="compact"
                        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
                        pageSizeOptions={[25, 50, 100]}
                        columns={[
                            {
                                field: "invoice_no",
                                headerName: "Broj",
                                width: 110,
                                valueGetter: (_v, r) => `${r.invoice_no}/${r.invoice_year}`,
                            },
                            {
                                field: "invoice_fiskal_no",
                                headerName: "Fisk.",
                                width: 80,
                                renderCell: (p) => {
                                    if (p.row.fiskal_required) return <Chip label="F2" size="small" color="primary" sx={{ height: 20, fontWeight: 700 }} />;
                                    return p.row.invoice_fiskal_no || "—";
                                },
                            },
                            {
                                field: "invoice_date",
                                headerName: "Datum",
                                width: 160,
                                valueFormatter: (v) => v ? new Date(v).toLocaleString("hr-HR") : "",
                            },
                            { field: "buyer_name", headerName: "Kupac", flex: 1, minWidth: 160,
                                valueGetter: (_v, r) => r.buyer_company_name || r.buyer_name || "—" },
                            {
                                field: "invoice_amount",
                                headerName: "Iznos",
                                width: 110,
                                align: "right",
                                headerAlign: "right",
                                valueFormatter: (v) => fmtEUR(v),
                            },
                            {
                                field: "invoice_payment_method_name",
                                headerName: "Plaćanje",
                                width: 120,
                            },
                            {
                                field: "actions",
                                headerName: "",
                                width: 170,
                                sortable: false,
                                filterable: false,
                                renderCell: (p) => {
                                    const isCanceled = p.row.invoice_canceled || p.row.invoice_status === "canceled";
                                    return (
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            {isCanceled && (
                                                <Chip label="STORNO" size="small" color="error" sx={{ height: 20, fontWeight: 700 }} />
                                            )}
                                            <IconButton
                                                size="small"
                                                title="Račun PDF"
                                                onClick={(e) => { e.stopPropagation(); window.open(invoicePdfUrl(p.row.invoice_uuid), "_blank"); }}
                                            >
                                                <PictureAsPdfIcon fontSize="small" color="error" />
                                            </IconButton>
                                            {p.row.order_uuid && !isCanceled && (
                                                <IconButton
                                                    size="small"
                                                    title="Karte PDF"
                                                    onClick={(e) => { e.stopPropagation(); window.open(ticketsPdfUrl(p.row.order_uuid), "_blank"); }}
                                                >
                                                    <ReceiptLongIcon fontSize="small" color="primary" />
                                                </IconButton>
                                            )}
                                        </Stack>
                                    );
                                },
                            },
                        ]}
                        onRowClick={(p) => window.open(invoicePdfUrl(p.row.invoice_uuid), "_blank")}
                        sx={{ "& .MuiDataGrid-row:hover": { cursor: "pointer" } }}
                    />
                </Box>
            </Drawer>
        </Box>
    );
}
