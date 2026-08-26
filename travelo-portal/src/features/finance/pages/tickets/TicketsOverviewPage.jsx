import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    MenuItem,
    Paper,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import CancelIcon from "@mui/icons-material/Cancel";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
    fetchTicketsThunk,
    fetchLinesThunk,
    fetchHarborsThunk,
    fetchBusinessPremisesListThunk,
    fetchBillingDevicesFullThunk,
    fetchSalesRoutesThunk,
    fetchPartnersListThunk,
    financeSliceData,
    setTicketsFilter,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import CancelTicketsModal from "./CancelTicketsModal";
import TransferTicketsModal from "./TransferTicketsModal";
import TransferResultDialog from "./TransferResultDialog";

// Kanali prodaje odgovaraju tipovima poslovnog prostora. Karta sama ne nosi
// kanal — cita se s racuna s kojeg je prodana.
const KANALI = [
    { key: "POSL", label: "Blagajna" },
    { key: "MOBIL", label: "Mobilna" },
    { key: "URED", label: "Ured" },
    { key: "WEB_OFFICE", label: "Web" },
    // Partnerske karte nemaju račun u trenutku prodaje (naplaćuju se zbirno
    // partneru), pa se ne traže preko poslovnog prostora nego po partneru.
    { key: "PARTNER", label: "Partner" },
];

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

const parseDeparture = (s) => {
    if (!s) return null;
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(String(s));
    if (dmy) {
        const [, d, m, y, hh = "00", mm = "00"] = dmy;
        return new Date(`${y}-${m}-${d}T${String(hh).padStart(2, "0")}:${mm}:00`);
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?/.exec(String(s));
    if (iso) {
        const [, y, m, d, hh = "00", mm = "00"] = iso;
        return new Date(`${y}-${m}-${d}T${String(hh).padStart(2, "0")}:${mm}:00`);
    }
    return null;
};

// Status karte ne piše svi isto: POS šalje ISSUED / VALIDATE / CANCELED,
// validacija upisuje "validated", storno "canceled", otkaz polaska
// "trip_canceled", a partnerski računi "issued". Svedi na jedan skup da
// filtriranje po tabovima ne ovisi o tome tko je redak upisao.
const STATUS_ALIASES = {
    ISSUED: "issued",
    CREATED: "issued",
    VALIDATE: "validated",
    VALIDATED: "validated",
    CANCELED: "canceled",
    CANCELLED: "canceled",
    TRIP_CANCELED: "trip_canceled",
};
const normStatus = (t) => {
    const raw = String(t?.status || "").trim().toUpperCase();
    // Storno se u nekim putanjama vidi samo po zastavicama, bez statusa.
    if (!raw) return t?.is_canceled ? "canceled" : "issued";
    return STATUS_ALIASES[raw] || raw.toLowerCase();
};

// Naziv i boja statusa u tablici.
const STATUS_DISPLAY = {
    issued: { label: "Izdana", fg: "#1b5e20", bg: "#c8e6c9" },
    validated: { label: "Validirana", fg: "#0d47a1", bg: "#bbdefb" },
    trip_canceled: { label: "Otkazan polazak", fg: "#e65100", bg: "#ffe0b2" },
    canceled: { label: "Stornirana", fg: "#b71c1c", bg: "#ffcdd2" },
};

const TAB_FILTERS = [
    // Na "Sve" se namjerno ne nudi ništa: u istom popisu stoje karte svih
    // statusa, pa bi radnja nad odabirom bila nagađanje.
    { key: "ALL", label: "Sve", match: () => true, akcije: {} },
    { key: "issued", label: "Kreirane", match: (t) => normStatus(t) === "issued", akcije: { storno: true, prebacivanje: true } },
    {
        key: "valid",
        akcije: { storno: true, prebacivanje: true },
        label: "Valjane",
        match: (t) => {
            if (normStatus(t) !== "issued") return false;
            const d = parseDeparture(t.departure_planed);
            return d && d >= new Date();
        },
    },
    {
        key: "expired",
        akcije: { storno: true, prebacivanje: true },
        label: "Istekle",
        match: (t) => {
            if (normStatus(t) !== "issued") return false;
            const d = parseDeparture(t.departure_planed);
            return d && d < new Date();
        },
    },
    // Validirana karta je iskorištena, stornirana je već razriješena.
    { key: "validated", label: "Validirane", match: (t) => normStatus(t) === "validated", akcije: {} },
    // Otkazano putovanje: putniku se nudi povrat ili drugi polazak.
    { key: "trip_canceled", label: "Otkazane", match: (t) => normStatus(t) === "trip_canceled", akcije: { storno: true, prebacivanje: true } },
    { key: "canceled", label: "Stornirane", match: (t) => normStatus(t) === "canceled", akcije: {} },
];

export default function TicketsOverviewPage() {
    const dispatch = useDispatch();
    const {
        tickets,
        ticketsLoading,
        ticketsError,
        ticketsFilters,
        linesList,
        harborsList,
        businessPremisesList,
        billingDevicesFull,
        salesRoutes,
        partnersList,
    } = useSelector(financeSliceData);
    const [tab, setTab] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferResult, setTransferResult] = useState(null);

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        if (!linesList.length) dispatch(fetchLinesThunk());
        if (!businessPremisesList.length) dispatch(fetchBusinessPremisesListThunk());
        if (!billingDevicesFull.length) dispatch(fetchBillingDevicesFullThunk());
        if (!salesRoutes.length) dispatch(fetchSalesRoutesThunk());
        if (!partnersList.length) dispatch(fetchPartnersListThunk());
        if (!harborsList.length) dispatch(fetchHarborsThunk());
    }, [dispatch, linesList.length, harborsList.length, businessPremisesList.length,
        billingDevicesFull.length, salesRoutes.length, partnersList.length]);

    // Datum se ne čisti — bez njega pretraga ne radi, pa se vraća na danas.
    const ocistiFiltre = () => {
        dispatch(setTicketsFilter({ path: "date", value: new Date().toISOString().slice(0, 10) }));
        for (const p of ["line_code", "departure_harbor_id", "arrival_harbor_id", "ticket_code",
            "departure_key", "channel", "billing_device_uuid", "payment_method_uuid", "partner_uuid"]) {
            dispatch(setTicketsFilter({ path: p, value: "" }));
        }
    };

    const handleSearch = async () => {
        const params = {};
        if (ticketsFilters.ticket_code) {
            params.ticket_code = ticketsFilters.ticket_code;
        } else {
            params.date = ticketsFilters.date;
            if (ticketsFilters.line_code) params.line_code = ticketsFilters.line_code;
            if (ticketsFilters.departure_harbor_id) params.departure_harbor_id = ticketsFilters.departure_harbor_id;
            if (ticketsFilters.arrival_harbor_id) params.arrival_harbor_id = ticketsFilters.arrival_harbor_id;
            if (prostoriKanala.length) params.business_premise_uuids = prostoriKanala.join(",");
            if (ticketsFilters.channel === "PARTNER") {
                if (ticketsFilters.partner_uuid) params.partner_uuid = ticketsFilters.partner_uuid;
                else params.partner_only = "1";
            }
            if (ticketsFilters.billing_device_uuid) params.billing_device_uuid = ticketsFilters.billing_device_uuid;
            if (ticketsFilters.payment_method_uuid) params.payment_method_uuid = ticketsFilters.payment_method_uuid;
            const polazak = polasci.find((p) => p.key === ticketsFilters.departure_key);
            if (polazak) params.route_uuids = polazak.rute.join(",");
        }
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat karata…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchTicketsThunk(params));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    // Poslovni prostori odabranog kanala — pretraga ih trazi po uuid-u.
    const prostoriKanala = useMemo(() => {
        if (!ticketsFilters.channel || ticketsFilters.channel === "PARTNER") return [];
        return businessPremisesList
            .filter((bp) => String(bp.type || "").toUpperCase() === ticketsFilters.channel)
            .map((bp) => bp.uuid);
    }, [businessPremisesList, ticketsFilters.channel]);

    // Uredaji: unutar odabranog kanala, inace svi aktivni.
    const uredajiZaKanal = useMemo(() => {
        const skup = new Set(prostoriKanala);
        return billingDevicesFull.filter((bd) => bd.is_active
            && (!skup.size || skup.has(bd.business_premise_uuid)));
    }, [billingDevicesFull, prostoriKanala]);

    // Sredstva placanja se skupljaju s ponudenih uredaja — sifarnik ionako
    // vrijedi po uredaju, pa nema smisla nuditi ono cime se ne moze platiti.
    const sredstva = useMemo(() => {
        const m = new Map();
        for (const bd of uredajiZaKanal) {
            for (const pm of (bd.payment || bd.payment_methods || [])) {
                if (pm?.uuid && pm.is_active !== false) m.set(pm.uuid, pm.name);
            }
        }
        return [...m.entries()].map(([uuid, name]) => ({ uuid, name }));
    }, [uredajiZaKanal]);

    // Polasci odabranog dana (i linije, ako je odabrana). Jedan polazak je
    // vise ruta — trazi se po svima, jer karta nosi svoju relaciju.
    const polasci = useMemo(() => {
        const d = ticketsFilters.date;
        if (!d) return [];
        const dmy = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
        if (!dmy) return [];
        const trazeni = `${dmy[3]}/${dmy[2]}/${dmy[1]}`;
        const m = new Map();
        for (const r of salesRoutes) {
            if (r.departure_date !== trazeni) continue;
            if (ticketsFilters.line_code && r.line_code !== ticketsFilters.line_code) continue;
            const key = `${r.timetable_uuid}-${r.sequence}`;
            if (!m.has(key)) m.set(key, { key, line_code: r.line_code, vrijeme: r.departure_time, rute: [] });
            const g = m.get(key);
            g.rute.push(r.uuid);
            if ((r.departure_time || "") < (g.vrijeme || "")) g.vrijeme = r.departure_time;
        }
        return [...m.values()].sort((a, b) => String(a.vrijeme).localeCompare(String(b.vrijeme)));
    }, [salesRoutes, ticketsFilters.date, ticketsFilters.line_code]);
    const ticketsByStatus = useMemo(
        () => tickets.filter(TAB_FILTERS[tab].match),
        [tickets, tab]
    );

    // Reset selection when underlying rows change (e.g. tab switch / re-fetch)
    useEffect(() => {
        setSelectedIds([]);
    }, [tickets, tab]);

    const dopustene = TAB_FILTERS[tab].akcije || {};

    const selectedTickets = useMemo(
        () => ticketsByStatus.filter((t) => selectedIds.includes(t.id) && t.is_canceled !== true),
        [ticketsByStatus, selectedIds]
    );

    const refreshSearch = async () => {
        const params = {};
        if (ticketsFilters.ticket_code) {
            params.ticket_code = ticketsFilters.ticket_code;
        } else {
            params.date = ticketsFilters.date;
            if (ticketsFilters.line_code) params.line_code = ticketsFilters.line_code;
            if (ticketsFilters.departure_harbor_id) params.departure_harbor_id = ticketsFilters.departure_harbor_id;
            if (ticketsFilters.arrival_harbor_id) params.arrival_harbor_id = ticketsFilters.arrival_harbor_id;
            if (prostoriKanala.length) params.business_premise_uuids = prostoriKanala.join(",");
            if (ticketsFilters.channel === "PARTNER") {
                if (ticketsFilters.partner_uuid) params.partner_uuid = ticketsFilters.partner_uuid;
                else params.partner_only = "1";
            }
            if (ticketsFilters.billing_device_uuid) params.billing_device_uuid = ticketsFilters.billing_device_uuid;
            if (ticketsFilters.payment_method_uuid) params.payment_method_uuid = ticketsFilters.payment_method_uuid;
            const polazak = polasci.find((p) => p.key === ticketsFilters.departure_key);
            if (polazak) params.route_uuids = polazak.rute.join(",");
        }
        await dispatch(fetchTicketsThunk(params));
    };

    const columns = useMemo(
        () => [
            { field: "ticket_code", headerName: "Šifra", width: 110 },
            { field: "departure_planed", headerName: "Polazak", width: 140 },
            { field: "line_code", headerName: "Linija", width: 90 },
            { field: "departure_harbor_name", headerName: "Od", flex: 1, minWidth: 130 },
            { field: "arrival_harbor_name", headerName: "Do", flex: 1, minWidth: 130 },
            { field: "ticket_type_name", headerName: "Vrsta", flex: 1, minWidth: 140 },
            {
                field: "single_price",
                headerName: "Cijena",
                width: 100,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            // Kanal, uređaj i plaćanje dolaze s računa karte. Starije karte
            // nemaju vezu na račun pa ostaju prazne — vidi migraciju.
            {
                field: "business_premise_name",
                headerName: "Kanal",
                width: 140,
                // Partnerska karta nema račun, pa se umjesto prostora
                // prikazuje partner koji ju je prodao.
                valueGetter: (v, row) => (row.partner_uuid
                    ? (partnersList.find((p) => p.uuid === row.partner_uuid)?.partner_name || "Partner")
                    : v),
            },
            { field: "billing_device_mark", headerName: "NU", width: 70 },
            { field: "payment_method_name", headerName: "Plaćanje", width: 120 },
            { field: "invoice_no", headerName: "Račun", width: 100 },
            { field: "passanger_name", headerName: "Putnik", flex: 1, minWidth: 150 },
            { field: "passanger_email", headerName: "Email", flex: 1, minWidth: 180 },
            {
                field: "status",
                headerName: "Status",
                width: 130,
                // Boja i naziv idu po normaliziranom statusu, da POS-ov "ISSUED" i
                // backendov "issued" izgledaju isto.
                renderCell: (p) => {
                    const s = normStatus(p.row);
                    const cfg = STATUS_DISPLAY[s] || { label: p.value || "—", fg: "#5c646a", bg: "#f0f0f0" };
                    return (
                        <Box
                            sx={{
                                width: "100%",
                                textAlign: "center",
                                fontWeight: 600,
                                color: cfg.fg,
                                backgroundColor: cfg.bg,
                            }}
                        >
                            {cfg.label}
                        </Box>
                    );
                },
            },
            { field: "order_uuid", headerName: "Order UUID", flex: 1, minWidth: 280 },
        ],
        []
    );

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            {/* Tražilica: polja su grupirana po tome što opisuju — kada i kamo
                se putuje, pa tko je i čime prodao. Prije su svi filtri stajali u
                jednom redu koji se lomio, pa se nije vidjelo što ide s čim. */}
            <Paper variant="outlined" sx={{ p: 2, my: 2, borderRadius: 2 }}>
                <Typography variant="overline" color="text.secondary">Polazak i relacija</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 2, mt: 0.5 }}>
                    <TextField
                        size="small"
                        type="date"
                        label="Datum polaska"
                        InputLabelProps={{ shrink: true }}
                        value={ticketsFilters.date}
                        onChange={(e) => dispatch(setTicketsFilter({ path: "date", value: e.target.value }))}
                    />
                    <TextField
                        size="small"
                        select
                        label="Linija"
                        value={ticketsFilters.line_code}
                        onChange={(e) => dispatch(setTicketsFilter({ path: "line_code", value: e.target.value }))}
                    >
                        <MenuItem value="">— sve —</MenuItem>
                        {linesList.map((l) => (
                            <MenuItem key={l.uuid || l.code} value={l.code}>{l.code} · {l.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        size="small"
                        select
                        label="Polazak"
                        value={ticketsFilters.departure_key || ""}
                        onChange={(e) => dispatch(setTicketsFilter({ path: "departure_key", value: e.target.value }))}
                        helperText={!polasci.length ? "nema polazaka za taj dan" : " "}
                    >
                        <MenuItem value="">— svi —</MenuItem>
                        {polasci.map((p) => (
                            <MenuItem key={p.key} value={p.key}>{p.vrijeme} · {p.line_code}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        size="small"
                        select
                        label="Od luke"
                        value={ticketsFilters.departure_harbor_id}
                        onChange={(e) => dispatch(setTicketsFilter({ path: "departure_harbor_id", value: e.target.value }))}
                    >
                        <MenuItem value="">— sve —</MenuItem>
                        {harborsList.map((h) => (
                            <MenuItem key={h.uuid || h.code} value={h.code}>{h.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        size="small"
                        select
                        label="Do luke"
                        value={ticketsFilters.arrival_harbor_id}
                        onChange={(e) => dispatch(setTicketsFilter({ path: "arrival_harbor_id", value: e.target.value }))}
                    >
                        <MenuItem value="">— sve —</MenuItem>
                        {harborsList.map((h) => (
                            <MenuItem key={h.uuid || h.code} value={h.code}>{h.name}</MenuItem>
                        ))}
                    </TextField>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="overline" color="text.secondary">Prodaja</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 2, mt: 0.5 }}>
                    <TextField
                        size="small"
                        select
                        label="Kanal prodaje"
                        value={ticketsFilters.channel || ""}
                        onChange={(e) => {
                            dispatch(setTicketsFilter({ path: "channel", value: e.target.value }));
                            // Uređaj, sredstvo i partner ovise o kanalu — zadržani izbor bi
                            // nakon promjene tražio nešto čega u njemu nema.
                            dispatch(setTicketsFilter({ path: "billing_device_uuid", value: "" }));
                            dispatch(setTicketsFilter({ path: "payment_method_uuid", value: "" }));
                            dispatch(setTicketsFilter({ path: "partner_uuid", value: "" }));
                        }}
                    >
                        <MenuItem value="">— svi —</MenuItem>
                        {KANALI.map((k) => (
                            <MenuItem key={k.key} value={k.key}>{k.label}</MenuItem>
                        ))}
                    </TextField>
                    {ticketsFilters.channel === "PARTNER" ? (
                        <TextField
                            size="small"
                            select
                            label="Partner"
                            value={ticketsFilters.partner_uuid || ""}
                            onChange={(e) => dispatch(setTicketsFilter({ path: "partner_uuid", value: e.target.value }))}
                        >
                            <MenuItem value="">— svi partneri —</MenuItem>
                            {partnersList.filter((p) => p.is_active !== false).map((p) => (
                                <MenuItem key={p.uuid} value={p.uuid}>{p.partner_name}</MenuItem>
                            ))}
                        </TextField>
                    ) : (
                        <>
                            <TextField
                                size="small"
                                select
                                label="Naplatni uređaj"
                                value={ticketsFilters.billing_device_uuid || ""}
                                onChange={(e) => dispatch(setTicketsFilter({ path: "billing_device_uuid", value: e.target.value }))}
                            >
                                <MenuItem value="">— svi —</MenuItem>
                                {uredajiZaKanal.map((bd) => (
                                    <MenuItem key={bd.uuid} value={bd.uuid}>
                                        {bd.name}{bd.fiscal_mark ? ` · ${bd.fiscal_mark}` : ""}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                size="small"
                                select
                                label="Sredstvo plaćanja"
                                value={ticketsFilters.payment_method_uuid || ""}
                                onChange={(e) => dispatch(setTicketsFilter({ path: "payment_method_uuid", value: e.target.value }))}
                            >
                                <MenuItem value="">— sva —</MenuItem>
                                {sredstva.map((pm) => (
                                    <MenuItem key={pm.uuid} value={pm.uuid}>{pm.name}</MenuItem>
                                ))}
                            </TextField>
                        </>
                    )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Šifra karte nadjačava sve ostalo — stoji odvojeno da se vidi da
                    ostali filtri tada ne vrijede. */}
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                        size="small"
                        label="Šifra karte"
                        value={ticketsFilters.ticket_code}
                        onChange={(e) => dispatch(setTicketsFilter({ path: "ticket_code", value: e.target.value.toUpperCase() }))}
                        sx={{ width: 200 }}
                        helperText={ticketsFilters.ticket_code ? "traži se samo po šifri" : "nadjačava ostale filtre"}
                    />
                    <Box sx={{ flex: 1 }} />
                    <Chip label={`${tickets.length} karata`} />
                    <Button onClick={ocistiFiltre} disabled={ticketsLoading}>Očisti</Button>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={handleSearch}
                        disabled={ticketsLoading}
                    >
                        Pretraži
                    </Button>
                </Stack>
            </Paper>
            {ticketsError && <Alert severity="error" sx={{ mb: 2 }}>{ticketsError}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
                    {TAB_FILTERS.map((f) => {
                        const count = tickets.filter(f.match).length;
                        return <Tab key={f.key} label={`${f.label} (${count})`} />;
                    })}
                </Tabs>
            </Box>

            {/* Radnje ovise o kartici na kojoj se stoji — vidi TAB_FILTERS.
                Gumb koji na toj kartici nije dopušten se ne prikazuje: posivljen
                gumb izgleda kao da nešto nedostaje u odabiru, a zapravo ta
                radnja nad tim kartama uopće ne postoji. */}
            {(dopustene.storno || dopustene.prebacivanje) && (
                <Stack direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
                    {dopustene.storno && (
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<CancelIcon />}
                            disabled={selectedTickets.length === 0}
                            onClick={() => setCancelOpen(true)}
                        >
                            Storniraj ({selectedTickets.length})
                        </Button>
                    )}
                    {dopustene.prebacivanje && (
                        <Button
                            variant="contained"
                            color="warning"
                            startIcon={<SwapHorizIcon />}
                            disabled={!selectedTickets.length || selectedTickets.some((t) => t.partner_uuid)}
                            onClick={() => setTransferOpen(true)}
                        >
                            Prebaci na drugi polazak ({selectedTickets.length})
                        </Button>
                    )}
                </Stack>
            )}

            <Box sx={{ height: "68vh", minWidth: 1400 }}>
                <DataGrid
                    rows={ticketsByStatus}
                    getRowId={(r) => r.id}
                    columns={columns}
                    loading={ticketsLoading}
                    initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
                    pageSizeOptions={[25, 50, 100, 250]}
                    disableRowSelectionOnClick
                    checkboxSelection
                    onRowSelectionModelChange={(model) => {
                        if (model instanceof Set) setSelectedIds([...model]);
                        else if (Array.isArray(model)) setSelectedIds(model);
                        else if (model?.ids instanceof Set) setSelectedIds([...model.ids]);
                        else setSelectedIds([]);
                    }}
                    isRowSelectable={(p) => p.row.is_canceled !== true}
                />
            </Box>

            <CancelTicketsModal
                open={cancelOpen}
                tickets={selectedTickets}
                onClose={() => setCancelOpen(false)}
                onCanceled={() => { setSelectedIds([]); refreshSearch(); }}
            />

            <TransferTicketsModal
                open={transferOpen}
                tickets={selectedTickets}
                onClose={() => setTransferOpen(false)}
                onTransferred={(r) => {
                    setSelectedIds([]);
                    refreshSearch();
                    setTransferResult(r);
                }}
            />

            <TransferResultDialog result={transferResult} onClose={() => setTransferResult(null)} />
        </Box>
    );
}
