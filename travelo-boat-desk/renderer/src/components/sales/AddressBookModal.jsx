import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Divider,
    Grid,
    IconButton,
    Modal,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import { allAppData, setStateData } from "../../store/appSlice";

const emptyForm = {
    buyer_company_name: "",
    buyer_name: "",
    buyer_vat_id: "",
    buyer_address: "",
    buyer_postal_code: "",
    buyer_town: "",
    buyer_country: "Hrvatska",
    buyer_email: "",
    buyer_tel: "",
};

const fromBackend = (b) => ({
    buyer_uuid: "",
    buyer_company_name: b.name || "",
    buyer_name: b.name || "",
    buyer_vat_id: b.oib || "",
    buyer_address: b.address || "",
    buyer_postal_code: b.postal_code || "",
    buyer_town: b.town || "",
    buyer_country: "",
    buyer_email: b.email || "",
    buyer_tel: "",
});

export default function AddressBookModal() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const open = !!appData.modalsStates?.showAddressBookModal;
    const selected = appData.saleData?.selectedBuyer;

    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [mode, setMode] = useState("list"); // list | new
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        setMode("list");
        setForm(emptyForm);
        setError("");
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await window.api.app.getBuyersIPC({ limit: 500 });
                const list = res?.ok ? res.data : [];
                if (!cancelled) setBuyers(Array.isArray(list) ? list : []);
            } catch (e) {
                if (!cancelled) setError("Greška pri dohvatu adresara: " + (e?.message || e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return buyers;
        return buyers.filter((b) =>
            (b.name || "").toLowerCase().includes(q) ||
            (b.oib || "").toLowerCase().includes(q) ||
            (b.town || "").toLowerCase().includes(q) ||
            (b.email || "").toLowerCase().includes(q)
        );
    }, [buyers, search]);

    const rows = filtered.map((b, i) => ({ id: b.oib || `row-${i}`, ...b }));

    const handleClose = () => {
        dispatch(setStateData({ path: "modalsStates/showAddressBookModal", value: false }));
    };

    const handlePick = (buyer) => {
        dispatch(setStateData({ path: "saleData/selectedBuyer", value: fromBackend(buyer) }));
        handleClose();
    };

    const handleClear = () => {
        dispatch(setStateData({ path: "saleData/selectedBuyer", value: null }));
        handleClose();
    };

    const handleSaveNew = () => {
        const oib = form.buyer_vat_id.trim();
        const name = form.buyer_company_name.trim() || form.buyer_name.trim();
        if (!oib) return setError("OIB je obavezan.");
        if (!name) return setError("Naziv ili ime kupca je obavezan.");
        dispatch(setStateData({
            path: "saleData/selectedBuyer",
            value: {
                buyer_uuid: "",
                buyer_company_name: form.buyer_company_name.trim() || name,
                buyer_name: form.buyer_name.trim() || name,
                buyer_vat_id: oib,
                buyer_address: form.buyer_address.trim(),
                buyer_postal_code: form.buyer_postal_code.trim(),
                buyer_town: form.buyer_town.trim(),
                buyer_country: form.buyer_country.trim(),
                buyer_email: form.buyer_email.trim(),
                buyer_tel: form.buyer_tel.trim(),
            },
        }));
        handleClose();
    };

    const columns = [
        { field: "name", headerName: "Naziv / Ime", flex: 3 },
        { field: "oib", headerName: "OIB", flex: 1.2 },
        { field: "address", headerName: "Adresa", flex: 2 },
        { field: "town", headerName: "Mjesto", flex: 1.2 },
        { field: "email", headerName: "E-mail", flex: 2 },
    ];

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 1100,
                maxHeight: "90vh",
                bgcolor: "background.paper",
                borderRadius: 2,
                boxShadow: 24,
                p: 3,
                display: "flex",
                flexDirection: "column",
                gap: 2,
            }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Adresar — R1 kupci</Typography>
                    <IconButton onClick={handleClose}><CloseIcon /></IconButton>
                </Stack>

                {selected?.buyer_vat_id && (
                    <Alert severity="info" action={
                        <Button color="inherit" size="small" startIcon={<DeleteIcon />} onClick={handleClear}>
                            Ukloni
                        </Button>
                    }>
                        Trenutno odabran: <strong>{selected.buyer_company_name || selected.buyer_name}</strong> (OIB: {selected.buyer_vat_id})
                    </Alert>
                )}

                {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

                {mode === "list" ? (
                    <>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Pretraži (naziv, OIB, mjesto, e-mail)"
                                fullWidth
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                size="small"
                            />
                            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => { setError(""); setMode("new"); }}>
                                Novi kupac
                            </Button>
                        </Stack>
                        <Box sx={{ height: 480 }}>
                            <DataGrid
                                rows={rows}
                                columns={columns}
                                loading={loading}
                                disableColumnMenu
                                disableRowSelectionOnClick
                                onRowClick={(params) => handlePick(params.row)}
                                pageSizeOptions={[10, 25, 50]}
                                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                                localeText={{ noRowsLabel: "Nema kupaca u adresaru" }}
                            />
                        </Box>
                    </>
                ) : (
                    <>
                        <Typography variant="subtitle1">Unos novog kupca</Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 8 }}>
                                <TextField label="Naziv (tvrtka)" fullWidth size="small"
                                    value={form.buyer_company_name}
                                    onChange={(e) => setForm({ ...form, buyer_company_name: e.target.value })} />
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <TextField label="OIB *" fullWidth size="small"
                                    value={form.buyer_vat_id}
                                    onChange={(e) => setForm({ ...form, buyer_vat_id: e.target.value.replace(/\D/g, "") })} />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField label="Ime i prezime (osoba — opcionalno)" fullWidth size="small"
                                    value={form.buyer_name}
                                    onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} />
                            </Grid>
                            <Grid size={{ xs: 8 }}>
                                <TextField label="Adresa" fullWidth size="small"
                                    value={form.buyer_address}
                                    onChange={(e) => setForm({ ...form, buyer_address: e.target.value })} />
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <TextField label="Poštanski broj" fullWidth size="small"
                                    value={form.buyer_postal_code}
                                    onChange={(e) => setForm({ ...form, buyer_postal_code: e.target.value })} />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField label="Mjesto" fullWidth size="small"
                                    value={form.buyer_town}
                                    onChange={(e) => setForm({ ...form, buyer_town: e.target.value })} />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField label="Država" fullWidth size="small"
                                    value={form.buyer_country}
                                    onChange={(e) => setForm({ ...form, buyer_country: e.target.value })} />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField label="E-mail" fullWidth size="small" type="email"
                                    value={form.buyer_email}
                                    onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField label="Telefon" fullWidth size="small"
                                    value={form.buyer_tel}
                                    onChange={(e) => setForm({ ...form, buyer_tel: e.target.value })} />
                            </Grid>
                        </Grid>
                        <Divider />
                        <Stack direction="row" spacing={2} justifyContent="flex-end">
                            <Button onClick={() => setMode("list")}>Natrag</Button>
                            <Button variant="contained" startIcon={<CheckIcon />} onClick={handleSaveNew}>
                                Spremi i koristi
                            </Button>
                        </Stack>
                    </>
                )}
            </Box>
        </Modal>
    );
}
