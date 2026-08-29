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
    Tab,
    Tabs,
    TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import {
    fetchPartnerInvoicesThunk,
    fetchPartnersListThunk,
    financeSliceData,
    setPartnerInvoiceFilter,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import PartnerInvoicePreviewDrawer from "./PartnerInvoicePreviewDrawer";
import TabIzvjestajiZaProvizije from "./CommissionReportsTab";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmtDateTime = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString("hr-HR");
};

const YEAR_OPTIONS = (() => {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now + 1; y >= now - 5; y--) years.push(y);
    return years;
})();

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

// Računi koje mi izdajemo partneru za karte koje je prodao za svoj račun: novac
// je sjeo kod njega, pa mu fakturiramo prodano umanjeno za proviziju. Izdaju se
// po dinamici naplate podešenoj na partneru.
function TabRacuniZaProvizije() {
    const dispatch = useDispatch();
    const {
        partnerInvoices,
        partnerInvoicesLoading,
        partnerInvoicesError,
        partnerInvoiceFilters,
        partnersList,
    } = useSelector(financeSliceData);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const clickTimerRef = useRef(null);

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        if (!partnersList.length) dispatch(fetchPartnersListThunk());
    }, [dispatch, partnersList.length]);

    const handleSearch = async () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat partner računa…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        const params = { year: partnerInvoiceFilters.year };
        if (partnerInvoiceFilters.month) params.month = partnerInvoiceFilters.month;
        if (partnerInvoiceFilters.partner_uuid) params.partner_uuid = partnerInvoiceFilters.partner_uuid;
        await dispatch(fetchPartnerInvoicesThunk(params));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    useEffect(() => {
        handleSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const columns = useMemo(
        () => [
            { field: "invoice_date", headerName: "Datum", width: 160, valueFormatter: (v) => fmtDateTime(v) },
            { field: "partner_invoice_no", headerName: "Broj", width: 80 },
            {
                // Ono što piše na samom računu: F1 nosi fiskalnu oznaku, F2 svoj kod.
                field: "partner_invoice_code",
                headerName: "Oznaka",
                width: 130,
                renderCell: (params) => params.value || "—",
            },
            {
                field: "is_f2",
                headerName: "Tip",
                width: 70,
                renderCell: (params) => (params.value ? "F2" : "F1"),
            },
            { field: "invoice_year", headerName: "Godina", width: 100 },
            { field: "partner_name", headerName: "Partner", flex: 2, minWidth: 180 },
            { field: "partner_vat_id", headerName: "OIB/VAT", width: 140 },
            {
                field: "tickets_count",
                headerName: "Karte",
                width: 90,
                align: "right",
                headerAlign: "right",
            },
            {
                field: "gross_amount",
                headerName: "Bruto",
                width: 120,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "harbor_tax_amount",
                headerName: "Pristojba",
                width: 110,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "commission_base",
                headerName: "Osnovica",
                width: 120,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "commission_pct",
                headerName: "Prov. %",
                width: 100,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => `${Number(v || 0).toFixed(2)} %`,
            },
            {
                field: "commission_amount",
                headerName: "Provizija",
                width: 120,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "net_amount",
                // Iznos računa: osnovica bez provizije + PDV + cijela pristojba.
                headerName: "Za naplatu",
                width: 150,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "status",
                headerName: "Status",
                width: 120,
                renderCell: (params) => (
                    <Box
                        sx={{
                            width: "100%",
                            textAlign: "center",
                            fontWeight: 600,
                            color: params.value === "paid" ? "#1b5e20" : "#5c646a",
                            backgroundColor: params.value === "paid" ? "#c8e6c9" : "#f0f0f0",
                        }}
                    >
                        {params.value || "—"}
                    </Box>
                ),
            },
        ],
        []
    );

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Stack direction="row" spacing={2} sx={{ my: 2, flexWrap: "wrap" }} alignItems="center">
                <TextField
                    select
                    label="Godina"
                    value={partnerInvoiceFilters.year}
                    onChange={(e) =>
                        dispatch(setPartnerInvoiceFilter({ path: "year", value: Number(e.target.value) }))
                    }
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
                    label="Mjesec"
                    value={partnerInvoiceFilters.month}
                    onChange={(e) =>
                        dispatch(setPartnerInvoiceFilter({ path: "month", value: e.target.value === "" ? "" : Number(e.target.value) }))
                    }
                    sx={{ width: 180 }}
                >
                    <MenuItem value="">— svi —</MenuItem>
                    {MONTHS_HR.map((name, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                            {String(i + 1).padStart(2, "0")} — {name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Partner"
                    value={partnerInvoiceFilters.partner_uuid}
                    onChange={(e) =>
                        dispatch(setPartnerInvoiceFilter({ path: "partner_uuid", value: e.target.value }))
                    }
                    sx={{ width: 280 }}
                >
                    <MenuItem value="">— svi —</MenuItem>
                    {partnersList.map((p) => (
                        <MenuItem key={p.uuid} value={p.uuid}>
                            {p.partner_name}{!p.is_active ? " (neaktivan)" : ""}
                        </MenuItem>
                    ))}
                </TextField>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={handleSearch}
                    disabled={partnerInvoicesLoading}
                    sx={{ height: 56, px: 3 }}
                >
                    Pretraži
                </Button>
                <Chip label={`${partnerInvoices.length} rezultata`} />
            </Stack>

            {partnerInvoicesError && (
                <Alert severity="error" sx={{ mb: 2 }}>{partnerInvoicesError}</Alert>
            )}

            <Box sx={{ height: "75vh", minWidth: 1400 }}>
                <DataGrid
                    rows={partnerInvoices}
                    getRowId={(r) => r.id}
                    columns={columns}
                    loading={partnerInvoicesLoading}
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
                    // Širinu određuje sam dokument, kao i kod ostalih računa.
                    sx: { height: "100%", maxWidth: "100vw", overflow: "hidden" },
                }}
            >
                <PartnerInvoicePreviewDrawer
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                />
            </Drawer>
        </Box>
    );
}

// Partnerski novac ide u dva smjera i ne miješa se: mi njemu fakturiramo karte
// koje je prodao za svoj račun, a on nama proviziju za karte koje je prodao za
// naš. Zato dva odvojena prikaza pod istom stavkom izbornika.
export default function PartnerInvoicesPage() {
    const [tab, setTab] = useState(0);

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%" }}>
            <Tabs
                value={tab}
                onChange={(e, v) => setTab(v)}
                sx={{ borderBottom: "1px solid", borderColor: "divider" }}
            >
                <Tab label="Računi za provizije" />
                <Tab label="Izvještaji za provizije" />
            </Tabs>
            {tab === 0 ? <TabRacuniZaProvizije /> : <TabIzvjestajiZaProvizije />}
        </Box>
    );
}
