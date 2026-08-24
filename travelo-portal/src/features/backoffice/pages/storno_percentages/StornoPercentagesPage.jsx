import { Alert, Box, Button, Drawer, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";

// Šifarnik postotaka storniranja. Blagajnik na terminalu bira jednu od ovih
// vrijednosti umjesto da postotak upisuje slobodno.
export default function StornoPercentagesPage() {
    const dispatch = useDispatch();
    const backofficeData = useSelector(backofficeSliceData);

    const [openAdd, setOpenAdd] = useState(false);
    const [newData, setNewData] = useState({});
    const [error, setError] = useState("");

    const syncData = async () => {
        await dispatch(setAuthData({ path: 'loading', value: true }));
        await dispatch(setAuthData({ path: 'loadingMessage', value: 'Preuzimanje postotaka storniranja' }));
        await dispatch(getBackofficeThunk({ path: 'storno_percentages' }));
        await dispatch(setAuthData({ path: 'loading', value: false }));
    };

    useEffect(() => {
        syncData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e) => {
        setNewData({ ...newData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        await dispatch(setAuthData({ path: 'loading', value: true }));
        await dispatch(setAuthData({ path: 'loadingMessage', value: 'Dodavanje postotka' }));
        const res = await dispatch(postBackofficeThunk({ path: 'storno_percentages', data: newData }));
        await dispatch(setAuthData({ path: 'loading', value: false }));
        // Backoffice odbija duplikat i vrijednost izvan 0–100; bez ove poruke bi
        // izgledalo kao da se ništa nije dogodilo.
        const err = res?.payload?.error;
        if (err) {
            setError(err);
            return;
        }
        setNewData({});
        setOpenAdd(false);
    };

    const handleToggleRow = async (row) => {
        await dispatch(setAuthData({ path: 'loading', value: true }));
        await dispatch(setAuthData({ path: 'loadingMessage', value: 'Ažuriranje postotka' }));
        await dispatch(patchBackofficeThunk({
            path: 'storno_percentages',
            data: { uuid: row.uuid, is_active: row.is_active === false },
        }));
        await dispatch(setAuthData({ path: 'loading', value: false }));
    };

    const rowActions = useRowClickActions({ onToggle: handleToggleRow });

    const columns = [
        {
            field: 'percentage',
            headerName: 'Postotak',
            width: 140,
            valueGetter: (_v, row) => `${Number(row.percentage || 0).toFixed(2).replace(/\.00$/, "")} %`,
        },
        { field: 'name', headerName: 'Opis', flex: 3 },
        {
            field: 'is_active',
            headerName: 'Aktivan',
            width: 120,
            valueGetter: (_v, row) => (row.is_active ? 'DA' : 'NE'),
        },
    ];

    const rows = backofficeData.backofficeData.storno_percentages || [];

    return (
        <>
            <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
                <GridHint text="Dupli klik na redak — aktiviraj/deaktiviraj postotak. Neaktivni se ne nude blagajniku." />
                <Box sx={{ height: "80vh", minWidth: 800 }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        getRowId={(row) => row.id}
                        getRowClassName={(params) => (params.row.is_active ? "" : "row-inactive")}
                        sx={{ "& .row-inactive": { opacity: 0.5 } }}
                        {...rowActions}
                    />
                </Box>
            </Box>

            <Drawer
                anchor="right"
                open={openAdd}
                onClose={() => { setOpenAdd(false); setError(""); }}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 520 }, maxWidth: "100vw" } }}
            >
                <Box sx={{ mx: 5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3, mt: 3 }}>
                        <Typography variant="h5" fontWeight="bold">Novi postotak storniranja</Typography>
                        <Button onClick={() => { setOpenAdd(false); setError(""); }}>Zatvori</Button>
                    </Stack>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label="Postotak (0 - 100)"
                        required
                        value={newData.percentage ?? ""}
                        onChange={handleChange}
                        name="percentage"
                        inputProps={{ min: 0, max: 100, step: 0.5 }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="Opis (npr. otkaz više od 24h prije polaska)"
                        value={newData.name || ""}
                        onChange={handleChange}
                        name="name"
                        sx={{ mt: 2 }}
                    />
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={
                            newData.percentage === undefined
                            || newData.percentage === ""
                            || Number(newData.percentage) < 0
                            || Number(newData.percentage) > 100
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                    >
                        Dodaj postotak
                    </Button>
                </Box>
            </Drawer>

            <Stack sx={{ width: '96%', ml: 1 }} alignItems="flex-start">
                <Button onClick={() => setOpenAdd(true)}>Dodaj postotak</Button>
            </Stack>
        </>
    );
}
