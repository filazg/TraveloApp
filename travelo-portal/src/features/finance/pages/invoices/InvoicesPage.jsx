import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    Drawer,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import {
    fetchBillingDevicesThunk,
    fetchInvoicesThunk,
    financeSliceData,
    setFilter,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import InvoicePreviewDrawer from "./InvoicePreviewDrawer";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmtDateTime = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString("hr-HR");
};

const MONTHS_HR = [
    "Siječanj",
    "Veljača",
    "Ožujak",
    "Travanj",
    "Svibanj",
    "Lipanj",
    "Srpanj",
    "Kolovoz",
    "Rujan",
    "Listopad",
    "Studeni",
    "Prosinac",
];

const YEAR_OPTIONS = (() => {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now + 1; y >= now - 5; y--) years.push(y);
    return years;
})();

export default function InvoicesPage() {
    const dispatch = useDispatch();
    const { invoices, loading, error, filters, billingDevices } = useSelector(financeSliceData);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const clickTimerRef = useRef(null);

    useEffect(() => {
        const boot = async () => {
            if (!billingDevices.length) await dispatch(fetchBillingDevicesThunk());
            dispatch(setAuthData({ path: "loading", value: false }));
        };
        boot();
    }, [dispatch, billingDevices.length]);

    // Mjesec je obavezan samo kad nema text filtera. S bilo kojim text filterom
    // (email, tvrtka, fisk. broj) može se tražiti kroz cijelu godinu na uređaju.
    const hasTextFilter = Boolean(filters.buyer_email || filters.buyer_company_name || filters.invoice_code);
    const canSearch = Boolean(filters.billing_device_uuid && filters.year && (filters.month || hasTextFilter));

    const handleSearch = async () => {
        if (!canSearch) return;
        const params = {
            billing_device_uuid: filters.billing_device_uuid,
            year: filters.year,
        };
        // S text filterom tražimo kroz cijelu godinu — mjesec se ne šalje.
        if (filters.month && !hasTextFilter) params.month = filters.month;
        if (filters.buyer_email) params.buyer_email = filters.buyer_email;
        if (filters.buyer_company_name) params.buyer_company_name = filters.buyer_company_name;
        if (filters.invoice_code) params.invoice_code = filters.invoice_code;
        if (filters.invoice_status) params.invoice_status = filters.invoice_status;
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat računa…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchInvoicesThunk(params));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const columns = useMemo(
        () => [
            { field: "invoice_date", headerName: "Datum", width: 160, valueFormatter: (v) => fmtDateTime(v) },
            {
                field: "invoice_no",
                headerName: "Broj",
                width: 90,
                valueGetter: (_v, row) => row.invoice_no || row.invoice_uuid?.slice(0, 8) || "",
            },
            {
                field: "invoice_code",
                headerName: "Broj računa",
                width: 180,
                // F2 račun nema NO/PP/NU oznaku nego vlastiti kod u invoice_code —
                // po njemu ga kupac i prepoznaje, pa se prikazuje jednako kao i
                // fiskalna oznaka F1 računa. Stanje fiskalizacije ionako ima svoju
                // kolonu (F2), a JIR se vidi u tooltipu kad stigne.
                valueGetter: (_v, row) => row.invoice_code
                    || row.invoice_JIR
                    || (row.fiskal_required && row.yescor_status === "submitted" ? "F2 u tijeku…" : "—"),
                renderCell: (params) => {
                    const row = params.row || {};
                    const jir = row.invoice_JIR;
                    return (
                        <Tooltip title={jir ? `JIR: ${jir}` : ""}>
                            <span>{params.value}</span>
                        </Tooltip>
                    );
                },
            },
            { field: "buyer_name", headerName: "Kupac", flex: 2, minWidth: 140 },
            { field: "buyer_email", headerName: "Email", flex: 2, minWidth: 180 },
            { field: "buyer_company_name", headerName: "Tvrtka", flex: 2, minWidth: 140 },
            { field: "invoice_payment_method_name", headerName: "Plaćanje", width: 110 },
            {
                field: "invoice_amount",
                headerName: "Iznos",
                width: 120,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "invoice_status",
                headerName: "Status",
                width: 120,
                renderCell: (params) => (
                    <Box
                        sx={{
                            width: "100%",
                            textAlign: "center",
                            fontWeight: 600,
                            color:
                                params.value === "paid"
                                    ? "#1b5e20"
                                    : params.value === "declined"
                                    ? "#b71c1c"
                                    : "#5c646a",
                            backgroundColor:
                                params.value === "paid"
                                    ? "#c8e6c9"
                                    : params.value === "declined"
                                    ? "#ffcdd2"
                                    : "#f0f0f0",
                        }}
                    >
                        {params.value || "—"}
                    </Box>
                ),
            },
            {
                field: "fiskal_required",
                headerName: "F2",
                width: 130,
                renderCell: (params) => {
                    const row = params.row || {};
                    if (!row.fiskal_required) return <Box sx={{ color: "#9ca3af", textAlign: "center", width: "100%" }}>—</Box>;
                    const fisc = row.yescor_fiscalization_status; // not_required | pending | successful | error
                    const docStatus = row.yescor_status;           // submitted | sent | error | not_for_sending | ...
                    // Za testnu fazu: fisc = successful = PROŠAO (ignoriramo delivery).
                    let label = "Pending", bg = "#fef9c3", fg = "#854d0e";
                    if (fisc === "successful") {
                        label = "Fiskalizirano";
                        bg = "#c8e6c9"; fg = "#1b5e20";
                    } else if (fisc === "error" || docStatus === "failed") {
                        label = "Greška";
                        bg = "#ffcdd2"; fg = "#b71c1c";
                    } else if (docStatus === "submitted" || !fisc || fisc === "pending") {
                        label = "Obrada";
                        bg = "#e0f2fe"; fg = "#075985";
                    }
                    const tooltip = `doc_status=${docStatus || "-"}, fisc=${fisc || "-"}${row.yescor_error_message ? `, err=${row.yescor_error_message}` : ""}`;
                    return (
                        <Box
                            title={tooltip}
                            sx={{ width: "100%", textAlign: "center", fontWeight: 700, fontSize: 12, py: 0.5, color: fg, backgroundColor: bg, borderRadius: 0.5 }}
                        >
                            {label}
                        </Box>
                    );
                },
            },
        ],
        []
    );

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Stack direction="row" spacing={2} sx={{ my: 2, flexWrap: "wrap" }} alignItems="center">
                <TextField
                    select
                    label="Naplatni uređaj"
                    value={filters.billing_device_uuid}
                    onChange={(e) =>
                        dispatch(setFilter({ path: "billing_device_uuid", value: e.target.value }))
                    }
                    sx={{ width: 320 }}
                >
                    <MenuItem value="">— odaberi —</MenuItem>
                    {billingDevices.map((d) => (
                        <MenuItem key={d.uuid} value={d.uuid}>
                            {d.name}
                            {d.fiscal_mark ? ` · ${d.fiscal_mark}` : ""}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label={hasTextFilter ? "Mjesec (opcionalno)" : "Mjesec"}
                    value={hasTextFilter ? "" : filters.month}
                    disabled={hasTextFilter}
                    onChange={(e) => dispatch(setFilter({ path: "month", value: Number(e.target.value) }))}
                    sx={{ width: 200 }}
                    helperText={hasTextFilter ? "Cijela godina" : ""}
                >
                    {MONTHS_HR.map((name, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                            {String(i + 1).padStart(2, "0")} — {name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Godina"
                    value={filters.year}
                    onChange={(e) => dispatch(setFilter({ path: "year", value: Number(e.target.value) }))}
                    sx={{ width: 120 }}
                >
                    {YEAR_OPTIONS.map((y) => (
                        <MenuItem key={y} value={y}>
                            {y}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Status"
                    value={filters.invoice_status}
                    onChange={(e) => dispatch(setFilter({ path: "invoice_status", value: e.target.value }))}
                    sx={{ width: 160 }}
                >
                    <MenuItem value="">— svi —</MenuItem>
                    <MenuItem value="paid">Plaćeno</MenuItem>
                    <MenuItem value="pending">U obradi</MenuItem>
                    <MenuItem value="declined">Odbijeno</MenuItem>
                </TextField>
                <TextField
                    label="Email kupca"
                    value={filters.buyer_email}
                    onChange={(e) => dispatch(setFilter({ path: "buyer_email", value: e.target.value }))}
                    sx={{ width: 220 }}
                />
                <TextField
                    label="Naziv tvrtke"
                    value={filters.buyer_company_name}
                    onChange={(e) => dispatch(setFilter({ path: "buyer_company_name", value: e.target.value }))}
                    sx={{ width: 220 }}
                />
                <TextField
                    label="Broj računa"
                    value={filters.invoice_code}
                    onChange={(e) => dispatch(setFilter({ path: "invoice_code", value: e.target.value }))}
                    sx={{ width: 180 }}
                />
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={handleSearch}
                    disabled={!canSearch || loading}
                    sx={{ height: 56, px: 3 }}
                >
                    Pretraži
                </Button>
                <Chip label={`${invoices.length} rezultata`} />
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ height: "75vh", minWidth: 1200 }}>
                <DataGrid
                    rows={invoices}
                    getRowId={(r) => r.id}
                    columns={columns}
                    loading={loading}
                    initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    disableRowSelectionOnClick
                    onCellClick={(params) => {
                        clearTimeout(clickTimerRef.current);
                        clickTimerRef.current = setTimeout(() => {
                            setSelectedInvoice(params.row);
                        }, 200);
                    }}
                    sx={{ "& .MuiDataGrid-row:hover": { cursor: "pointer" } }}
                />
            </Box>

            <Drawer
                anchor="right"
                open={!!selectedInvoice}
                onClose={() => setSelectedInvoice(null)}
                PaperProps={{
                    sx: { height: "100%", maxWidth: "100vw", overflow: "hidden" },
                }}
            >
                <InvoicePreviewDrawer
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                />
            </Drawer>
        </Box>
    );
}
