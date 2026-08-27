import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Paper,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
    createPaymentOrderThunk,
    fetchPaymentOrdersThunk,
    financeSliceData,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import { useLoading } from "../../../loading/useLoading";
import PaymentOrderDetailsDialog from "./PaymentOrderDetailsDialog";
import { PROVIDERI, jeSepa } from "./providers";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
// Datumi dolaze iz baze u ISO obliku; prikazuje se lokalno, bez sekundi.
const fmtDateTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
};

const STATUS_CHIP = {
    open: { label: "Otvoren", color: "success" },
    closed: { label: "Zatvoren", color: "default" },
};

// Nalozi su razdvojeni po tome kome se predaju — banci ili pojedinoj
// kartičarskoj kući. Zato kartice, a ne jedan popis s filtrom: nalog se uvijek
// gleda unutar jednog primatelja.
export default function PaymentOrdersPage() {
    const dispatch = useDispatch();
    const auth = useSelector((s) => s.auth);
    const { paymentOrders, paymentOrdersLoading, paymentOrdersError, nalogSaving, nalogError } = useSelector(financeSliceData);
    const { tijekom } = useLoading();

    const [tab, setTab] = useState(0);
    const [status, setStatus] = useState("all");
    const [noviOpen, setNoviOpen] = useState(false);
    const [noviNaziv, setNoviNaziv] = useState("");
    const [odabrani, setOdabrani] = useState(null);

    const provider = PROVIDERI[tab];

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
    }, [dispatch]);

    useEffect(() => {
        dispatch(fetchPaymentOrdersThunk({ status, provider: provider.key }));
    }, [dispatch, status, provider.key]);

    const osvjezi = () => dispatch(fetchPaymentOrdersThunk({ status, provider: provider.key }));

    const kreiraj = async () => {
        const naziv = noviNaziv.trim();
        if (!naziv) return;
        const res = await tijekom("Kreiranje naloga", () => dispatch(createPaymentOrderThunk({
            name: naziv,
            provider: provider.key,
            created_by: auth?.loggedUserData?.username || "",
        })));
        if (res.meta.requestStatus === "fulfilled") {
            setNoviOpen(false);
            setNoviNaziv("");
            osvjezi();
        }
    };

    const columns = [
        { field: "name", headerName: "Naziv naloga", flex: 1, minWidth: 220 },
        {
            field: "status",
            headerName: "Status",
            width: 130,
            renderCell: (p) => {
                const s = STATUS_CHIP[p.value] || { label: p.value, color: "default" };
                return <Chip size="small" label={s.label} color={s.color} variant={p.value === "open" ? "filled" : "outlined"} />;
            },
        },
        { field: "items_count", headerName: "Povrata", width: 90, align: "right", headerAlign: "right" },
        {
            field: "total_amount",
            headerName: "Ukupno",
            width: 130,
            align: "right",
            headerAlign: "right",
            renderCell: (p) => <b>{fmtEUR(p.value)}</b>,
        },
        { field: "createdAt", headerName: "Kreiran", width: 150, valueGetter: (v) => fmtDateTime(v) },
        { field: "created_by", headerName: "Kreirao", width: 130 },
        { field: "closed_at", headerName: "Zatvoren", width: 150, valueGetter: (v) => fmtDateTime(v) },
    ];

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%" }}>
            <Paper variant="outlined" sx={{ p: 1.5, my: 1, borderRadius: 2 }}>
                <Typography variant="h6">Platni nalozi</Typography>
                <Tabs
                    value={tab}
                    onChange={(_e, v) => { setTab(v); setOdabrani(null); }}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}
                >
                    {PROVIDERI.map((p) => <Tab key={p.key} label={p.label} />)}
                </Tabs>

                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" color="text.secondary">{provider.opis}</Typography>
                    <TextField
                        size="small"
                        select
                        label="Status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        sx={{ minWidth: 150 }}
                    >
                        <MenuItem value="all">Svi</MenuItem>
                        <MenuItem value="open">Otvoreni</MenuItem>
                        <MenuItem value="closed">Zatvoreni</MenuItem>
                    </TextField>
                    <Button startIcon={<RefreshIcon />} onClick={osvjezi}>Osvježi</Button>
                    <Box sx={{ flex: 1 }} />
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNoviOpen(true)}>
                        Novi {provider.label} nalog
                    </Button>
                </Stack>
            </Paper>

            {(paymentOrdersError || nalogError) && (
                <Alert severity="error" sx={{ mb: 1 }}>{paymentOrdersError || nalogError}</Alert>
            )}

            <Box sx={{ height: "60vh" }}>
                <DataGrid
                    rows={paymentOrders}
                    getRowId={(r) => r.payment_order_uuid}
                    columns={columns}
                    loading={paymentOrdersLoading}
                    disableRowSelectionOnClick
                    onRowClick={(p) => setOdabrani(p.row.payment_order_uuid)}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 25, page: 0 } },
                        sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
                    }}
                    pageSizeOptions={[25, 50, 100]}
                    sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
                />
            </Box>

            <Dialog open={noviOpen} onClose={() => setNoviOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Novi nalog — {provider.label}</DialogTitle>
                <DialogContent dividers>
                    {/* Pri otvaranju se upisuje samo naziv — stavke i iznos dolaze
                        kasnije, iz storna. */}
                    <TextField
                        autoFocus
                        fullWidth
                        label="Naziv naloga"
                        value={noviNaziv}
                        onChange={(e) => setNoviNaziv(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") kreiraj(); }}
                        sx={{ mt: 1 }}
                        helperText={jeSepa(provider.key)
                            ? "Povrati na račun, predaju se banci kao SEPA datoteka"
                            : `Povrati na karticu, predaju se kući ${provider.label} kao izvještaj`}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNoviOpen(false)}>Odustani</Button>
                    <Button variant="contained" onClick={kreiraj} disabled={!noviNaziv.trim() || nalogSaving}>
                        Kreiraj
                    </Button>
                </DialogActions>
            </Dialog>

            <PaymentOrderDetailsDialog
                paymentOrderUuid={odabrani}
                onClose={() => setOdabrani(null)}
                onChanged={osvjezi}
            />
        </Box>
    );
}
