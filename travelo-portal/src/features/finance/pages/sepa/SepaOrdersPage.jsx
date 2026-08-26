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
    TextField,
    Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
    createSepaOrderThunk,
    fetchSepaOrdersThunk,
    financeSliceData,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import { useLoading } from "../../../loading/useLoading";
import SepaOrderDetailsDialog from "./SepaOrderDetailsDialog";

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

export default function SepaOrdersPage() {
    const dispatch = useDispatch();
    const auth = useSelector((s) => s.auth);
    const { sepaOrders, sepaOrdersLoading, sepaOrdersError, sepaSaving, sepaError } = useSelector(financeSliceData);

    const { tijekom } = useLoading();
    const [status, setStatus] = useState("all");
    const [noviOpen, setNoviOpen] = useState(false);
    const [noviNaziv, setNoviNaziv] = useState("");
    const [odabrani, setOdabrani] = useState(null);

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
    }, [dispatch]);

    useEffect(() => {
        dispatch(fetchSepaOrdersThunk({ status }));
    }, [dispatch, status]);

    const osvjezi = () => dispatch(fetchSepaOrdersThunk({ status }));

    const kreiraj = async () => {
        const naziv = noviNaziv.trim();
        if (!naziv) return;
        const res = await tijekom("Kreiranje SEPA naloga", () => dispatch(createSepaOrderThunk({
            name: naziv,
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
        { field: "items_count", headerName: "Stavki", width: 90, align: "right", headerAlign: "right" },
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
            <Paper variant="outlined" sx={{ p: 2, my: 2, borderRadius: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" sx={{ mr: 1 }}>SEPA nalozi</Typography>
                    <TextField
                        size="small"
                        select
                        label="Status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        sx={{ minWidth: 170 }}
                    >
                        <MenuItem value="all">Svi</MenuItem>
                        <MenuItem value="open">Otvoreni</MenuItem>
                        <MenuItem value="closed">Zatvoreni</MenuItem>
                    </TextField>
                    <Button startIcon={<RefreshIcon />} onClick={osvjezi}>Osvježi</Button>
                    <Box sx={{ flex: 1 }} />
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNoviOpen(true)}>
                        Novi nalog
                    </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    Nalog okuplja povrate na račun. Stavke u njega ulaze kroz storno karata
                    („Vrati na IBAN"), a zatvaranjem se nalog zaključava.
                </Typography>
            </Paper>

            {(sepaOrdersError || sepaError) && (
                <Alert severity="error" sx={{ mb: 1 }}>{sepaOrdersError || sepaError}</Alert>
            )}

            <Box sx={{ height: "60vh" }}>
                <DataGrid
                    rows={sepaOrders}
                    getRowId={(r) => r.sepa_order_uuid}
                    columns={columns}
                    loading={sepaOrdersLoading}
                    disableRowSelectionOnClick
                    onRowClick={(p) => setOdabrani(p.row.sepa_order_uuid)}
                    initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                    pageSizeOptions={[25, 50, 100]}
                    sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
                />
            </Box>

            <Dialog open={noviOpen} onClose={() => setNoviOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Novi SEPA nalog</DialogTitle>
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
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNoviOpen(false)}>Odustani</Button>
                    <Button variant="contained" onClick={kreiraj} disabled={!noviNaziv.trim() || sepaSaving}>
                        Kreiraj
                    </Button>
                </DialogActions>
            </Dialog>

            <SepaOrderDetailsDialog
                sepaOrderUuid={odabrani}
                onClose={() => setOdabrani(null)}
                onChanged={osvjezi}
            />
        </Box>
    );
}
