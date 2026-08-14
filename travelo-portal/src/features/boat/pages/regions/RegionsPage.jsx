import { Box, Button, Chip, Drawer, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { useT } from "../../../../i18n/useT";
import { setAuthData } from "../../../auth/authSlice";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk } from "../../boatSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";

export default function RegionsPage() {
    const dispatch = useDispatch();
    const boatData = useSelector(boatSliceData);
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null);
    const [openAdd, setOpenAdd] = useState(false);
    const [newData, setNewData] = useState({});
    const [editedData, setEditedData] = useState({});

    // Lučke uprave nemaju is_active — samo klik za uređivanje.
    const rowActions = useRowClickActions({ onEdit: (row) => setSelectedRow(row) });

    const syncData = async () => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat lučkih uprava" }));
        await dispatch(getBoatThunk({ path: "regions" }));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    useEffect(() => { syncData(); /* eslint-disable-next-line */ }, []);
    useEffect(() => { if (selectedRow) setEditedData(selectedRow); }, [selectedRow]);

    const handleSubmit = async () => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Dodavanje lučke uprave" }));
        await dispatch(postBoatThunk({ path: "regions", data: newData }));
        setNewData({});
        setOpenAdd(false);
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const handleSubmitEdit = async () => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Ažuriranje lučke uprave" }));
        await dispatch(patchBoatThunk({ path: "regions", data: editedData }));
        setSelectedRow(null);
        setEditedData({});
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const columns = [
        { field: "code", headerName: t("boat.regions.code"), width: 150 },
        { field: "name", headerName: t("boat.regions.name"), flex: 2 },
    ];

    const rows = boatData.boatData.regions || [];

    return (
        <>
            <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
                <Stack direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
                    <GridHint withToggle={false} />
                    <Chip label={`${rows.length}`} size="small" />
                </Stack>
                <Box sx={{ height: "80vh", minWidth: 700 }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        getRowId={(r) => r.id}
                        {...rowActions}
                    />
                </Box>
            </Box>

            <Stack sx={{ width: "96%", ml: 1, mt: 1 }} alignItems="flex-start">
                <Button onClick={() => setOpenAdd(true)}>{t("boat.regions.add")}</Button>
            </Stack>

            <Drawer
                anchor="right"
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 480 }, maxWidth: "100vw" } }}
            >
                <Box sx={{ mx: 4, mt: 2 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">{t("boat.regions.add_title")}</Typography>
                        <Button onClick={() => setOpenAdd(false)}>Zatvori</Button>
                    </Stack>
                    <TextField
                        fullWidth
                        label={t("boat.regions.name")}
                        value={newData.name || ""}
                        onChange={(e) => setNewData({ ...newData, name: e.target.value })}
                        required
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label={t("boat.regions.code")}
                        value={newData.code || ""}
                        onChange={(e) => setNewData({ ...newData, code: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={!newData.name}
                        sx={{ mt: 3, height: 56, width: "100%" }}
                    >
                        {t("boat.regions.add")}
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
                        <Typography variant="h5" fontWeight="bold">{t("boat.regions.edit_title")}</Typography>
                        <Button onClick={() => setSelectedRow(null)}>Zatvori</Button>
                    </Stack>
                    <TextField
                        fullWidth
                        label={t("boat.regions.name")}
                        value={editedData.name || ""}
                        onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label={t("boat.regions.code")}
                        value={editedData.code || ""}
                        onChange={(e) => setEditedData({ ...editedData, code: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSubmitEdit}
                        sx={{ mt: 3, height: 56, width: "100%" }}
                    >
                        {t("boat.regions.save")}
                    </Button>
                </Box>
            </Drawer>
        </>
    );
}
