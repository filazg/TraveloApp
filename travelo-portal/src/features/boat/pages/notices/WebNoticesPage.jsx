import { Alert, Box, Button, Chip, Drawer, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk } from "../../boatSlice";
import { setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";

// Obavijesti koje web stranica prikazuje posjetiteljima — prekid plovidbe,
// izmjena plovidbenog reda, radno vrijeme blagajne. Stranica ih povlaci kroz
// web-sales `/web_page_info`.
//
// Razdoblje prikaza se vodi ovdje: obavijest se napise unaprijed i sama nestane
// kad prode, bez da je itko mora ici gasiti.

const RAZINE = [
    { value: "info", label: "Obavijest", color: "info" },
    { value: "warning", label: "Upozorenje", color: "warning" },
    { value: "urgent", label: "Hitno", color: "error" },
];

const razina = (v) => RAZINE.find((r) => r.value === v) || RAZINE[0];

// <input type="datetime-local"> radi s lokalnim vremenom bez zone, a spremamo
// pravi trenutak — pa se pretvara u oba smjera.
const uPolje = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const izPolja = (v) => (v ? new Date(v).toISOString() : null);

const prikaziVrijeme = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Vidi li je posjetitelj bas sada — spoj statusa i razdoblja prikaza. Bez toga
// se iz tablice ne vidi je li obavijest zaista na stranici.
const naStranici = (o) => {
    if (!o?.is_active) return false;
    const sada = Date.now();
    if (o.valid_from && new Date(o.valid_from).getTime() > sada) return false;
    if (o.valid_to && new Date(o.valid_to).getTime() < sada) return false;
    return true;
};

const prazna = { title: "", text: "", severity: "info", valid_from: "", valid_to: "" };

export default function WebNoticesPage() {
    const dispatch = useDispatch();
    const boatData = useSelector(boatSliceData);

    const [open, setOpen] = useState(false);
    const [data, setData] = useState(prazna);
    const [error, setError] = useState("");

    const syncData = async () => {
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(setAuthData({ path: "loadingMessage", value: "Preuzimanje obavijesti" }));
        await dispatch(getBoatThunk({ path: "web_notices" }));
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    useEffect(() => {
        syncData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e) => setData({ ...data, [e.target.name]: e.target.value });

    const handleOpenNew = () => {
        setData(prazna);
        setError("");
        setOpen(true);
    };

    const handleEdit = (row) => {
        setData({
            uuid: row.uuid,
            title: row.title || "",
            text: row.text || "",
            severity: row.severity || "info",
            valid_from: uPolje(row.valid_from),
            valid_to: uPolje(row.valid_to),
        });
        setError("");
        setOpen(true);
    };

    const handleSubmit = async () => {
        setError("");
        if (data.valid_from && data.valid_to && data.valid_to < data.valid_from) {
            setError("Kraj prikaza je prije početka.");
            return;
        }
        const zaSlanje = {
            ...data,
            valid_from: izPolja(data.valid_from),
            valid_to: izPolja(data.valid_to),
        };
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(setAuthData({ path: "loadingMessage", value: "Spremanje obavijesti" }));
        if (data.uuid) {
            await dispatch(patchBoatThunk({ path: "web_notices", data: zaSlanje }));
        } else {
            await dispatch(postBoatThunk({ path: "web_notices", data: zaSlanje }));
        }
        await dispatch(setAuthData({ path: "loading", value: false }));
        setData(prazna);
        setOpen(false);
    };

    const handleToggleRow = async (row) => {
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(setAuthData({ path: "loadingMessage", value: "Ažuriranje obavijesti" }));
        await dispatch(patchBoatThunk({
            path: "web_notices",
            data: { uuid: row.uuid, is_active: row.is_active === false },
        }));
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    const rowActions = useRowClickActions({ onEdit: handleEdit, onToggle: handleToggleRow });

    const columns = [
        { field: "title", headerName: "Naslov", flex: 3 },
        {
            field: "severity",
            headerName: "Razina",
            width: 140,
            renderCell: (params) => {
                const r = razina(params.value);
                return <Chip size="small" color={r.color} variant="outlined" label={r.label} />;
            },
        },
        {
            field: "valid_from",
            headerName: "Prikaz od",
            width: 170,
            valueGetter: (_v, row) => prikaziVrijeme(row.valid_from),
        },
        {
            field: "valid_to",
            headerName: "Prikaz do",
            width: 170,
            valueGetter: (_v, row) => prikaziVrijeme(row.valid_to),
        },
        {
            field: "na_stranici",
            headerName: "Na stranici",
            width: 150,
            renderCell: (params) => (
                params.row.is_active
                    ? <Chip size="small" color={naStranici(params.row) ? "success" : "default"}
                        label={naStranici(params.row) ? "Prikazuje se" : "Izvan razdoblja"} />
                    : <Chip size="small" label="Ugašena" />
            ),
        },
    ];

    const rows = boatData.boatData?.web_notices || [];

    return (
        <>
            <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
                <GridHint text="Klik na redak — uredi obavijest. Dupli klik — upali/ugasi je. Obavijest se prikazuje na web stranici dok traje razdoblje prikaza." />
                <Box sx={{ height: "78vh", minWidth: 900 }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        getRowId={(row) => row.id}
                        sx={{ "& .row-inactive": { opacity: 0.5 } }}
                        {...rowActions}
                    />
                </Box>
            </Box>

            <Drawer
                anchor="right"
                open={open}
                onClose={() => { setOpen(false); setError(""); }}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 560 }, maxWidth: "100vw" } }}
            >
                <Box sx={{ mx: 5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3, mt: 3 }}>
                        <Typography variant="h5" fontWeight="bold">
                            {data.uuid ? "Uredi obavijest" : "Nova obavijest"}
                        </Typography>
                        <Button onClick={() => { setOpen(false); setError(""); }}>Zatvori</Button>
                    </Stack>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <TextField
                        fullWidth
                        label="Naslov"
                        required
                        value={data.title}
                        onChange={handleChange}
                        name="title"
                    />
                    <TextField
                        fullWidth
                        label="Tekst obavijesti"
                        required
                        multiline
                        minRows={5}
                        value={data.text}
                        onChange={handleChange}
                        name="text"
                        sx={{ mt: 2 }}
                    />
                    <TextField
                        select
                        fullWidth
                        label="Razina"
                        value={data.severity}
                        onChange={handleChange}
                        name="severity"
                        sx={{ mt: 2 }}
                    >
                        {RAZINE.map((r) => (
                            <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                        ))}
                    </TextField>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
                        <TextField
                            type="datetime-local"
                            fullWidth
                            label="Prikaz od"
                            InputLabelProps={{ shrink: true }}
                            value={data.valid_from}
                            onChange={handleChange}
                            name="valid_from"
                        />
                        <TextField
                            type="datetime-local"
                            fullWidth
                            label="Prikaz do"
                            InputLabelProps={{ shrink: true }}
                            value={data.valid_to}
                            onChange={handleChange}
                            name="valid_to"
                        />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Prazan datum znači bez granice — bez početka vrijedi odmah, bez kraja dok je ne ugasite.
                    </Typography>

                    <Button
                        onClick={handleSubmit}
                        disabled={!data.title.trim() || !data.text.trim()}
                        sx={{ height: 60, mt: 3, width: "100%" }}
                        variant="contained"
                    >
                        {data.uuid ? "Spremi izmjene" : "Dodaj obavijest"}
                    </Button>
                </Box>
            </Drawer>

            <Stack sx={{ width: "96%", ml: 1 }} alignItems="flex-start">
                <Button onClick={handleOpenNew}>Dodaj obavijest</Button>
            </Stack>
        </>
    );
}
