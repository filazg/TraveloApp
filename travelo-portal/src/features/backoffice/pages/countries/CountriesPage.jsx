import { Box, Button, Drawer, FormControlLabel, Switch, Stack, TextField, Typography, Chip } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";

export default function CountriesPage() {
    const dispatch = useDispatch();
    const backofficeData = useSelector(backofficeSliceData);
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null);
    const [openAdd, setOpenAdd] = useState(false);
    const [newData, setNewData] = useState({});
    const [editedData, setEditedData] = useState({});

    const syncData = async () => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat popisa država" }));
        await dispatch(getBackofficeThunk({ path: "countries" }));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    useEffect(() => { syncData(); /* eslint-disable-next-line */ }, []);

    useEffect(() => { if (selectedRow) setEditedData(selectedRow); }, [selectedRow]);

    const handleSubmit = async () => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Dodavanje države" }));
        await dispatch(postBackofficeThunk({ path: "countries", data: newData }));
        setNewData({});
        setOpenAdd(false);
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const handleSubmitEdit = async () => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Ažuriranje države" }));
        await dispatch(patchBackofficeThunk({ path: "countries", data: editedData }));
        setSelectedRow(null);
        setEditedData({});
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const handleToggleActive = async (row) => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: row.is_active ? "Deaktivacija države" : "Aktivacija države" }));
        await dispatch(patchBackofficeThunk({ path: "countries", data: { ...row, is_active: !row.is_active } }));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const rowActions = useRowClickActions({
        onEdit: (row) => setSelectedRow(row),
        onToggle: handleToggleActive,
    });

    const columns = [
        { field: "code", headerName: t("backoffice.countries.code"), width: 100 },
        { field: "name_hr", headerName: t("backoffice.countries.name_hr"), flex: 2 },
        { field: "name_en", headerName: t("backoffice.countries.name_en"), flex: 2 },
        {
            field: "is_active",
            headerName: t("backoffice.countries.is_active"),
            width: 120,
            renderCell: (p) => (
                <Chip
                    size="small"
                    label={p.value ? "Aktivna" : "Neaktivna"}
                    sx={{ fontWeight: 600, bgcolor: p.value ? "#c8e6c9" : "#ffcdd2", color: p.value ? "#1b5e20" : "#b71c1c" }}
                />
            ),
        },
    ];

    const rows = backofficeData.backofficeData.countries || [];

    return (
        <>
            <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
                <Stack direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
                    <GridHint />
                    <Chip label={`${rows.length} zemalja`} size="small" />
                </Stack>
                <Box sx={{ height: "80vh", minWidth: 900 }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        getRowId={(r) => r.id}
                        {...rowActions}
                        initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
                        pageSizeOptions={[25, 50, 100, 250]}
                    />
                </Box>
            </Box>

            <Stack sx={{ width: "96%", ml: 1, mt: 1 }} alignItems="flex-start">
                <Button onClick={() => setOpenAdd(true)}>{t("backoffice.countries.add")}</Button>
            </Stack>

            <Drawer
                anchor="right"
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 480 }, maxWidth: "100vw" } }}
            >
                <Box sx={{ mx: 4, mt: 2 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">{t("backoffice.countries.add_title")}</Typography>
                        <Button onClick={() => setOpenAdd(false)}>Zatvori</Button>
                    </Stack>
                    <TextField
                        fullWidth
                        label={t("backoffice.countries.code")}
                        value={newData.code || ""}
                        onChange={(e) => setNewData({ ...newData, code: e.target.value.toUpperCase() })}
                        inputProps={{ maxLength: 2, style: { textTransform: "uppercase" } }}
                        required
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label={t("backoffice.countries.name_hr")}
                        value={newData.name_hr || ""}
                        onChange={(e) => setNewData({ ...newData, name_hr: e.target.value })}
                        required
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label={t("backoffice.countries.name_en")}
                        value={newData.name_en || ""}
                        onChange={(e) => setNewData({ ...newData, name_en: e.target.value })}
                        required
                        sx={{ mt: 1 }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={!newData.code || !newData.name_hr || !newData.name_en || newData.code.length !== 2}
                        sx={{ mt: 3, height: 56, width: "100%" }}
                    >
                        {t("backoffice.countries.add")}
                    </Button>
                </Box>
            </Drawer>

            <Drawer
                anchor="right"
                open={!!selectedRow}
                onClose={() => setSelectedRow(null)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 480 }, maxWidth: "100vw" } }}
            >
                <Box sx={{ mx: 4, mt: 2 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">{t("backoffice.countries.edit_title")}</Typography>
                        <Button onClick={() => setSelectedRow(null)}>Zatvori</Button>
                    </Stack>
                    <TextField
                        fullWidth
                        label={t("backoffice.countries.code")}
                        value={editedData.code || ""}
                        disabled
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label={t("backoffice.countries.name_hr")}
                        value={editedData.name_hr || ""}
                        onChange={(e) => setEditedData({ ...editedData, name_hr: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label={t("backoffice.countries.name_en")}
                        value={editedData.name_en || ""}
                        onChange={(e) => setEditedData({ ...editedData, name_en: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                            <Switch
                                checked={!!editedData.is_active}
                                onChange={(e) => setEditedData({ ...editedData, is_active: e.target.checked })}
                            />
                        }
                        label={t("backoffice.countries.is_active")}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSubmitEdit}
                        sx={{ mt: 3, height: 56, width: "100%" }}
                    >
                        {t("backoffice.countries.save")}
                    </Button>
                </Box>
            </Drawer>
        </>
    );
}
