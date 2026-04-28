import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    MenuItem,
    Stack,
    Tab,
    Tabs,
    TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import {
    fetchTicketsThunk,
    fetchLinesThunk,
    fetchHarborsThunk,
    financeSliceData,
    setTicketsFilter,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import CancelTicketsModal from "./CancelTicketsModal";
import CancelIcon from "@mui/icons-material/Cancel";

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

const TAB_FILTERS = [
    { key: "ALL", label: "Sve", match: () => true },
    { key: "created", label: "Kreirane", match: (t) => t.status === "created" },
    {
        key: "valid",
        label: "Valjane",
        match: (t) => {
            if (t.status !== "created") return false;
            const d = parseDeparture(t.departure_planed);
            return d && d >= new Date();
        },
    },
    {
        key: "expired",
        label: "Istekle",
        match: (t) => {
            if (t.status !== "created") return false;
            const d = parseDeparture(t.departure_planed);
            return d && d < new Date();
        },
    },
    { key: "validated", label: "Validirane", match: (t) => t.status === "validated" },
    { key: "trip_canceled", label: "Otkazane", match: (t) => t.status === "trip_canceled" },
    { key: "canceled", label: "Stornirane", match: (t) => t.status === "canceled" },
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
    } = useSelector(financeSliceData);
    const [tab, setTab] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [cancelOpen, setCancelOpen] = useState(false);

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        if (!linesList.length) dispatch(fetchLinesThunk());
        if (!harborsList.length) dispatch(fetchHarborsThunk());
    }, [dispatch, linesList.length, harborsList.length]);

    const handleSearch = async () => {
        const params = {};
        if (ticketsFilters.ticket_code) {
            params.ticket_code = ticketsFilters.ticket_code;
        } else {
            params.date = ticketsFilters.date;
            if (ticketsFilters.line_code) params.line_code = ticketsFilters.line_code;
            if (ticketsFilters.departure_harbor_id) params.departure_harbor_id = ticketsFilters.departure_harbor_id;
            if (ticketsFilters.arrival_harbor_id) params.arrival_harbor_id = ticketsFilters.arrival_harbor_id;
        }
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat karata…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchTicketsThunk(params));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const ticketsByStatus = useMemo(
        () => tickets.filter(TAB_FILTERS[tab].match),
        [tickets, tab]
    );

    // Reset selection when underlying rows change (e.g. tab switch / re-fetch)
    useEffect(() => {
        setSelectedIds([]);
    }, [tickets, tab]);

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
            { field: "passanger_name", headerName: "Putnik", flex: 1, minWidth: 150 },
            { field: "passanger_email", headerName: "Email", flex: 1, minWidth: 180 },
            {
                field: "status",
                headerName: "Status",
                width: 120,
                renderCell: (p) => (
                    <Box
                        sx={{
                            width: "100%",
                            textAlign: "center",
                            fontWeight: 600,
                            color:
                                p.value === "paid" ? "#1b5e20"
                                : p.value === "canceled" ? "#b71c1c"
                                : "#5c646a",
                            backgroundColor:
                                p.value === "paid" ? "#c8e6c9"
                                : p.value === "canceled" ? "#ffcdd2"
                                : "#f0f0f0",
                        }}
                    >
                        {p.value || "—"}
                    </Box>
                ),
            },
            { field: "order_uuid", headerName: "Order UUID", flex: 1, minWidth: 280 },
        ],
        []
    );

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Stack direction="row" spacing={2} sx={{ my: 2, flexWrap: "wrap" }} alignItems="center">
                <TextField
                    type="date"
                    label="Datum polaska"
                    InputLabelProps={{ shrink: true }}
                    value={ticketsFilters.date}
                    onChange={(e) => dispatch(setTicketsFilter({ path: "date", value: e.target.value }))}
                    sx={{ width: 180 }}
                />
                <TextField
                    select
                    label="Linija"
                    value={ticketsFilters.line_code}
                    onChange={(e) => dispatch(setTicketsFilter({ path: "line_code", value: e.target.value }))}
                    sx={{ width: 220 }}
                >
                    <MenuItem value="">— sve —</MenuItem>
                    {linesList.map((l) => (
                        <MenuItem key={l.uuid || l.code} value={l.code}>
                            {l.code} · {l.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Od luke"
                    value={ticketsFilters.departure_harbor_id}
                    onChange={(e) => dispatch(setTicketsFilter({ path: "departure_harbor_id", value: e.target.value }))}
                    sx={{ width: 200 }}
                >
                    <MenuItem value="">— sve —</MenuItem>
                    {harborsList.map((h) => (
                        <MenuItem key={h.uuid || h.code} value={h.code}>
                            {h.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Do luke"
                    value={ticketsFilters.arrival_harbor_id}
                    onChange={(e) => dispatch(setTicketsFilter({ path: "arrival_harbor_id", value: e.target.value }))}
                    sx={{ width: 200 }}
                >
                    <MenuItem value="">— sve —</MenuItem>
                    {harborsList.map((h) => (
                        <MenuItem key={h.uuid || h.code} value={h.code}>
                            {h.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    label="Šifra karte"
                    value={ticketsFilters.ticket_code}
                    onChange={(e) => dispatch(setTicketsFilter({ path: "ticket_code", value: e.target.value.toUpperCase() }))}
                    sx={{ width: 160 }}
                    helperText="override filter"
                />
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={handleSearch}
                    disabled={ticketsLoading}
                    sx={{ height: 56, px: 3 }}
                >
                    Pretraži
                </Button>
                <Chip label={`${tickets.length} karata`} />
            </Stack>

            {ticketsError && <Alert severity="error" sx={{ mb: 2 }}>{ticketsError}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
                    {TAB_FILTERS.map((f) => {
                        const count = tickets.filter(f.match).length;
                        return <Tab key={f.key} label={`${f.label} (${count})`} />;
                    })}
                </Tabs>
            </Box>

            <Stack direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
                <Button
                    variant="contained"
                    color="error"
                    startIcon={<CancelIcon />}
                    disabled={selectedTickets.length === 0}
                    onClick={() => setCancelOpen(true)}
                >
                    Storniraj ({selectedTickets.length})
                </Button>
            </Stack>

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
        </Box>
    );
}
