import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
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
    fetchGeneratedCommissionReportsThunk,
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

// Nazivi dinamike onako kako stoje na partneru.
const DINAMIKA_HR = {
    MONTHLY: "Mjesečno",
    SEMI_MONTHLY: "Dvaput mjesečno",
    WEEKLY: "Tjedno",
};

// Granice razdoblja dolaze kao YYYY-MM-DD; u tablici se čitaju domaćim redom.
const datumHR = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? `${m[3]}.${m[2]}.${m[1]}.` : "";
};

// Izvještaji za proviziju — podloga po kojoj partner nama ispostavlja račun.
//
// Obuhvaćaju isključivo prodaju koju je partner odradio u naše ime, na svom
// prodajnom mjestu s našom opremom: taj je novac naš, a njemu pripada provizija.
// Prodaja za njegov vlastiti račun ovdje NE ulazi — ondje ide obrnuto, mi njemu
// fakturiramo karte, i to je prvi tab.
//
// Ovdje se ništa ne računa u trenutku otvaranja. Prikazuju se dokumenti koje je
// noćni prolaz zamrznuo po dinamici dogovorenoj s partnerom, pa se iznos ne
// mijenja ako se karta naknadno stornira. Razdoblje se zato i ne bira rukom —
// određuje ga dinamika, a ovdje se samo pretražuje po godini i partneru.
export default function CommissionReportsTab() {
    const dispatch = useDispatch();
    const finance = useSelector(financeSliceData);

    const [godina, setGodina] = useState(new Date().getFullYear());
    const [partnerUuid, setPartnerUuid] = useState("");
    const [odabrani, setOdabrani] = useState(null);
    const clickTimerRef = useRef(null);

    const podaci = finance.partnerCommissionGenerated || {};
    const izvjestaji = podaci.reports || [];

    const trazi = async () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat izvještaja…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchGeneratedCommissionReportsThunk({
            year: godina,
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
        { field: "report_no", headerName: "Br.", width: 70, align: "right", headerAlign: "right" },
        { field: "partner_name", headerName: "Partner", flex: 2, minWidth: 200 },
        { field: "partner_legal_id", headerName: "OIB", width: 140 },
        {
            field: "razdoblje",
            headerName: "Razdoblje",
            width: 210,
            valueGetter: (v, row) => `${datumHR(row.period_from)} – ${datumHR(row.period_to)}`,
        },
        {
            field: "billing_cycle",
            headerName: "Dinamika",
            width: 150,
            valueFormatter: (v) => DINAMIKA_HR[v] || v || "",
        },
        {
            field: "tickets_count",
            headerName: "Karte",
            width: 90,
            align: "right",
            headerAlign: "right",
        },
        {
            field: "gross_amount",
            headerName: "Promet",
            width: 130,
            align: "right",
            headerAlign: "right",
            valueFormatter: (v) => fmtEUR(v),
        },
        {
            field: "base_amount",
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
            field: "commission_amount",
            headerName: "Provizija",
            width: 140,
            align: "right",
            headerAlign: "right",
            valueFormatter: (v) => fmtEUR(v),
        },
    ];

    // Dokument u ladici i dalje očekuje redak obračuna, pa se snimka prevodi u
    // taj oblik — razdoblje uz njega ide iz samog izvještaja, ne iz filtra gore.
    const zaLadicu = odabrani
        ? {
            partner_uuid: odabrani.partner_uuid,
            partner_name: odabrani.partner_name,
            partner_legal_id: odabrani.partner_legal_id,
            tickets: odabrani.tickets_count,
            gross: odabrani.gross_amount,
            base: odabrani.base_amount,
            commission_pct: odabrani.commission_pct,
            commission: odabrani.commission_amount,
        }
        : null;

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
                    disabled={finance.partnerCommissionGeneratedLoading}
                    sx={{ height: 56, px: 3 }}
                >
                    Pretraži
                </Button>
                <Chip label={`${izvjestaji.length} izvještaja`} />
                {izvjestaji.length ? (
                    <Chip
                        color="primary"
                        label={`Ukupno provizija: ${fmtEUR(podaci.totals?.commission)}`}
                    />
                ) : null}
            </Stack>

            <Box sx={{ height: "75vh", minWidth: 1100 }}>
                <DataGrid
                    rows={izvjestaji}
                    getRowId={(r) => r.report_uuid}
                    columns={columns}
                    loading={finance.partnerCommissionGeneratedLoading}
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
                    partner={zaLadicu}
                    from={odabrani?.period_from}
                    to={odabrani?.period_to}
                    nazivTvrtke={odabrani?.company_name}
                    onClose={() => setOdabrani(null)}
                />
            </Drawer>
        </Box>
    );
}
