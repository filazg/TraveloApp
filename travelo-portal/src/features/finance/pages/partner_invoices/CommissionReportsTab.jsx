import { useEffect, useRef, useState } from "react";
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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import {
    fetchPartnerCommissionReportsThunk,
    fetchPartnersListThunk,
    financeSliceData,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import CommissionReportDrawer from "./CommissionReportDrawer";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

const YEAR_OPTIONS = (() => {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now + 1; y >= now - 5; y--) years.push(y);
    return years;
})();

const MONTHS_HR = [
    "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
    "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];

const dvoznamenkasti = (n) => String(n).padStart(2, "0");
// Razdoblje se slaže iz godine i mjeseca; bez mjeseca uzima se cijela godina.
const razdoblje = (godina, mjesec) => {
    if (!mjesec) return { from: `${godina}-01-01`, to: `${godina}-12-31` };
    const zadnji = new Date(godina, mjesec, 0).getDate();
    return { from: `${godina}-${dvoznamenkasti(mjesec)}-01`, to: `${godina}-${dvoznamenkasti(mjesec)}-${zadnji}` };
};

// Izvještaji za proviziju — podloga po kojoj partner nama ispostavlja račun.
//
// Obuhvaćaju isključivo prodaju koju je partner odradio u naše ime, na svom
// prodajnom mjestu s našom opremom: taj je novac naš, a njemu pripada provizija.
// Prodaja za njegov vlastiti račun ovdje NE ulazi — ondje ide obrnuto, mi njemu
// fakturiramo karte, i to je prvi tab.
//
// Prikaz i pretraga isti su kao kod računa: razdoblje i partner gore, popis u
// tablici, a klik na redak otvara sam izvještaj.
export default function CommissionReportsTab() {
    const dispatch = useDispatch();
    const finance = useSelector(financeSliceData);

    const [godina, setGodina] = useState(new Date().getFullYear());
    const [mjesec, setMjesec] = useState(new Date().getMonth() + 1);
    const [partnerUuid, setPartnerUuid] = useState("");
    const [odabrani, setOdabrani] = useState(null);
    const clickTimerRef = useRef(null);

    const podaci = finance.partnerCommissionReports || {};
    const partneri = podaci.partners || [];

    const trazi = async () => {
        const { from, to } = razdoblje(godina, mjesec);
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat izvještaja…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchPartnerCommissionReportsThunk({
            from,
            to,
            partner_uuid: partnerUuid || undefined,
        }));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        if (!(finance.partnersList || []).length) dispatch(fetchPartnersListThunk());
        trazi();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const columns = [
        { field: "partner_name", headerName: "Partner", flex: 2, minWidth: 200 },
        { field: "partner_legal_id", headerName: "OIB", width: 140 },
        {
            field: "tickets",
            headerName: "Karte",
            width: 90,
            align: "right",
            headerAlign: "right",
        },
        {
            field: "gross",
            headerName: "Promet",
            width: 130,
            align: "right",
            headerAlign: "right",
            valueFormatter: (v) => fmtEUR(v),
        },
        {
            field: "base",
            headerName: "Osnovica",
            width: 130,
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
            field: "commission",
            headerName: "Provizija",
            width: 140,
            align: "right",
            headerAlign: "right",
            valueFormatter: (v) => fmtEUR(v),
        },
    ];

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Stack direction="row" spacing={2} sx={{ my: 2, flexWrap: "wrap" }} alignItems="center">
                <TextField
                    select
                    label="Godina"
                    value={godina}
                    onChange={(e) => setGodina(Number(e.target.value))}
                    sx={{ width: 120 }}
                >
                    {YEAR_OPTIONS.map((y) => (
                        <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Mjesec"
                    value={mjesec}
                    onChange={(e) => setMjesec(e.target.value === "" ? "" : Number(e.target.value))}
                    sx={{ width: 180 }}
                >
                    <MenuItem value="">— cijela godina —</MenuItem>
                    {MONTHS_HR.map((name, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                            {dvoznamenkasti(i + 1)} — {name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label="Partner"
                    value={partnerUuid}
                    onChange={(e) => setPartnerUuid(e.target.value)}
                    sx={{ width: 280 }}
                >
                    <MenuItem value="">— svi —</MenuItem>
                    {(finance.partnersList || []).map((p) => (
                        <MenuItem key={p.uuid} value={p.uuid}>
                            {p.partner_name}{!p.is_active ? " (neaktivan)" : ""}
                        </MenuItem>
                    ))}
                </TextField>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={trazi}
                    disabled={finance.partnerCommissionReportsLoading}
                    sx={{ height: 56, px: 3 }}
                >
                    Pretraži
                </Button>
                <Chip label={`${partneri.length} rezultata`} />
                {partneri.length ? (
                    <Chip
                        color="primary"
                        label={`Ukupno provizija: ${fmtEUR(podaci.totals?.commission)}`}
                    />
                ) : null}
            </Stack>

            {finance.partnerCommissionReportsError && (
                <Alert severity="error" sx={{ mb: 2 }}>{finance.partnerCommissionReportsError}</Alert>
            )}

            <Box sx={{ height: "75vh", minWidth: 1100 }}>
                <DataGrid
                    rows={partneri}
                    getRowId={(r) => r.partner_uuid}
                    columns={columns}
                    loading={finance.partnerCommissionReportsLoading}
                    initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    disableRowSelectionOnClick
                    onCellClick={(params) => {
                        clearTimeout(clickTimerRef.current);
                        clickTimerRef.current = setTimeout(() => setOdabrani(params.row), 200);
                    }}
                    sx={{ "& .MuiDataGrid-row:hover": { cursor: "pointer" } }}
                />
            </Box>

            <Drawer
                anchor="right"
                open={!!odabrani}
                onClose={() => setOdabrani(null)}
                PaperProps={{
                    // Širinu određuje sam dokument, kao i kod računa.
                    sx: { height: "100%", maxWidth: "100vw", overflow: "hidden" },
                }}
            >
                <CommissionReportDrawer
                    partner={odabrani}
                    from={podaci.from}
                    to={podaci.to}
                    nazivTvrtke={podaci.company_name}
                    onClose={() => setOdabrani(null)}
                />
            </Drawer>
        </Box>
    );
}
