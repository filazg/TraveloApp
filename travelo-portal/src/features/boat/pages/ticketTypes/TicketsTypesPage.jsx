import { Box, Button, Drawer, FormControlLabel, ListSubheader, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { useT } from "../../../../i18n/useT";
import { useEffect, useMemo, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk } from "../../boatSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";
import {
    bookingSliceData,
    fetchCapacityCategoriesThunk,
    fetchTicketTypeMappingsThunk,
    saveTicketTypeMappingThunk,
} from "../../../booking/bookingSlice";
import { SEOP_TYPES, SEOP_TYPE_LABEL } from "./seopTypes";

// Dropdown za SEOP namjena — grupirano po kategoriji. MUI Select renderira
// ListSubheader kao neinteraktivan header red.
const renderSeopTypeOptions = () => {
    const groups = {};
    for (const t of SEOP_TYPES) {
        if (!groups[t.group]) groups[t.group] = [];
        groups[t.group].push(t);
    }
    const items = [<MenuItem key="_none" value="">— nije definirano —</MenuItem>];
    for (const [group, list] of Object.entries(groups)) {
        items.push(<ListSubheader key={`h-${group}`}>{group}</ListSubheader>);
        for (const t of list) {
            items.push(
                <MenuItem key={t.code} value={t.code}>
                    <strong>{t.code}</strong>&nbsp;— {t.label}
                </MenuItem>
            );
        }
    }
    return items;
};

export default function TicketsTypesPage() {
    const dispatch = useDispatch();
    const boatData = useSelector(boatSliceData);
    const booking = useSelector(bookingSliceData);
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null);
    const [openAdd, setOpenAdd] = useState(false);
    const [newData, setNewData] = useState({});
    const [editedData, setEditedData] = useState({});
    const [newCategoryUuid, setNewCategoryUuid] = useState("");
    const [editCategoryUuid, setEditCategoryUuid] = useState("");

    const syncData = async () => {
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Preuzimanje podataka o vrstama karata" }));
        await dispatch(getBoatThunk({ path: "tickets_types" }));
        await dispatch(fetchCapacityCategoriesThunk());
        await dispatch(fetchTicketTypeMappingsThunk());
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    useEffect(() => { syncData(); /* eslint-disable-next-line */ }, []);

    const mappingByTt = useMemo(() => {
        const m = new Map();
        for (const row of booking.mappings) m.set(row.ticket_type_uuid, row);
        return m;
    }, [booking.mappings]);

    const categoryByUuid = useMemo(() => {
        const m = new Map();
        for (const c of booking.categories) m.set(c.uuid, c);
        return m;
    }, [booking.categories]);

    const activeCategories = booking.categories.filter((c) => c.is_active);

    useEffect(() => {
        if (selectedRow) {
            setEditedData(selectedRow);
            const current = mappingByTt.get(selectedRow.uuid);
            setEditCategoryUuid(current?.category_uuid || "");
        }
    }, [selectedRow, mappingByTt]);

    const handleChange = (e) => setNewData({ ...newData, [e.target.name]: e.target.value });
    const handleChangeEdit = (e) => setEditedData({ ...editedData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Dodavanje nove vrste karata" }));
        await dispatch(postBoatThunk({ path: "tickets_types", data: newData }));
        if (newCategoryUuid) {
            const res = await dispatch(getBoatThunk({ path: "tickets_types" }));
            const list = res.payload?.data || res.payload?.data?.data || [];
            const tt = list.find((r) => r.name === newData.name);
            if (tt?.uuid) {
                await dispatch(saveTicketTypeMappingThunk({
                    ticket_type_uuid: tt.uuid,
                    ticket_type_name: tt.name,
                    category_uuid: newCategoryUuid,
                    is_active: true,
                }));
            }
        }
        await syncData();
        setNewData({});
        setNewCategoryUuid("");
        setOpenAdd(false);
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        dispatch(setAuthData({ path: "loading", value: true }));
        dispatch(setAuthData({ path: "loadingMessage", value: "Ažuriranje podataka o vrsti karte" }));
        await dispatch(patchBoatThunk({ path: "tickets_types", data: editedData }));
        // category intentionally not re-saved on edit — locked at creation
        await syncData();
        setEditedData({});
        setEditCategoryUuid("");
        setSelectedRow(null);
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const handleToggleActive = async (row) => {
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(setAuthData({ path: "loadingMessage", value: row.is_active ? "Deaktivacija vrste karte" : "Aktivacija vrste karte" }));
        await dispatch(patchBoatThunk({ path: "tickets_types", data: { ...row, is_active: !row.is_active } }));
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    const rowActions = useRowClickActions({
        onEdit: (row) => setSelectedRow(row),
        onToggle: handleToggleActive,
    });

    const columns = [
        { field: "name", headerName: t("boat.tickets_types.name"), flex: 3 },
        { field: "name_eng", headerName: t("boat.tickets_types.name_eng"), flex: 3 },
        {
            field: "seop_type",
            headerName: "SEOP namjena",
            flex: 2,
            valueGetter: (_v, row) =>
                row.seop_type ? `${row.seop_type} — ${SEOP_TYPE_LABEL[row.seop_type] || ""}` : "—",
        },
        {
            field: "is_island",
            type: "boolean",
            headerName: "Otočna",
            flex: 1,
        },
        {
            field: "capacity_category",
            headerName: "Kategorija kapaciteta",
            flex: 2,
            valueGetter: (_v, row) => {
                const m = mappingByTt.get(row.uuid);
                if (!m) return "—";
                const c = categoryByUuid.get(m.category_uuid);
                return c ? `${c.name_hr} (${c.code})` : m.category_code || "—";
            },
        },
        { field: "is_active", type: "boolean", headerName: t("boat.tickets_types.is_active"), flex: 1 },
    ];

    return (
        <>
            <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
                <GridHint />
                <Box sx={{ height: "80vh", minWidth: 1200 }}>
                    <DataGrid
                        rows={boatData.boatData.tickets_types || []}
                        columns={columns}
                        getRowId={(row) => row.id}
                        {...rowActions}
                    />
                </Box>
            </Box>

            <Drawer
                anchor="right"
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 520, md: 680 }, maxWidth: "100vw" } }}
            >
                <Box sx={{ mx: 5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">
                            {t("boat.tickets_types.add_new_title")}
                        </Typography>
                        <Button onClick={() => setOpenAdd(false)}>{t("boat.tickets_types.close")}</Button>
                    </Stack>
                    <TextField fullWidth required label={t("boat.tickets_types.name")} value={newData.name || ""} onChange={handleChange} name="name" />
                    <TextField fullWidth label={t("boat.tickets_types.name_eng")} value={newData.name_eng || ""} onChange={handleChange} name="name_eng" sx={{ mt: 1 }} />
                    <TextField
                        select
                        fullWidth
                        label="SEOP namjena"
                        helperText="Šalje se u SEOP kao `namjena` prilikom dojave prodaje"
                        value={newData.seop_type || ""}
                        onChange={handleChange}
                        name="seop_type"
                        sx={{ mt: 1 }}
                    >
                        {renderSeopTypeOptions()}
                    </TextField>
                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                            <Switch
                                checked={!!newData.is_island}
                                onChange={(e) => setNewData({ ...newData, is_island: e.target.checked })}
                            />
                        }
                        label="Otočna karta — pri prodaji se traži otočna iskaznica i SEOP popust"
                    />
                    <TextField
                        select
                        fullWidth
                        required
                        label="Kategorija kapaciteta"
                        helperText="Određuje koji kapacitet plovila se troši ovom kartom"
                        value={newCategoryUuid}
                        onChange={(e) => setNewCategoryUuid(e.target.value)}
                        sx={{ mt: 1 }}
                    >
                        <MenuItem value="">—</MenuItem>
                        {activeCategories.map((c) => (
                            <MenuItem key={c.uuid} value={c.uuid}>{c.name_hr} ({c.code})</MenuItem>
                        ))}
                    </TextField>
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={!newData.name || !newCategoryUuid}
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                    >
                        {t("boat.tickets_types.add_button")}
                    </Button>
                </Box>
            </Drawer>

            <Drawer
                anchor="right"
                open={!!selectedRow}
                onClose={() => setSelectedRow(null)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 520, md: 680 }, maxWidth: "100vw" } }}
            >
                <Box sx={{ mx: 5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">
                            {t("backoffice.business_premises.edit_title")}
                        </Typography>
                        <Button onClick={() => setSelectedRow(null)}>{t("backoffice.business_premises.close")}</Button>
                    </Stack>
                    <TextField fullWidth required label={t("boat.tickets_types.name")} value={editedData?.name || ""} onChange={handleChangeEdit} name="name" />
                    <TextField fullWidth label={t("boat.tickets_types.name_eng")} value={editedData?.name_eng || ""} onChange={handleChangeEdit} name="name_eng" sx={{ mt: 1 }} />
                    <TextField
                        select
                        fullWidth
                        label="SEOP namjena"
                        helperText="Šalje se u SEOP kao `namjena` prilikom dojave prodaje"
                        value={editedData?.seop_type || ""}
                        onChange={handleChangeEdit}
                        name="seop_type"
                        sx={{ mt: 1 }}
                    >
                        {renderSeopTypeOptions()}
                    </TextField>
                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                            <Switch
                                disabled
                                checked={!!editedData?.is_island}
                            />
                        }
                        label="Otočna karta — postavlja se samo prilikom dodavanja vrste karte"
                    />
                    <TextField
                        select
                        fullWidth
                        disabled
                        label="Kategorija kapaciteta"
                        helperText="Kategorija kapaciteta se ne može mijenjati nakon kreiranja"
                        value={editCategoryUuid}
                        sx={{ mt: 1 }}
                    >
                        <MenuItem value="">—</MenuItem>
                        {booking.categories.map((c) => (
                            <MenuItem key={c.uuid} value={c.uuid}>{c.name_hr} ({c.code})</MenuItem>
                        ))}
                    </TextField>
                    <Button
                        type="submit"
                        onClick={handleSubmitEdit}
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                    >
                        {t("boat.harbors.edit_button")}
                    </Button>
                </Box>
            </Drawer>

            <Stack sx={{ width: "96%", ml: 1 }} alignItems="flex-start">
                <Button onClick={() => setOpenAdd(true)}>
                    {t("boat.tickets_types.add_ticket_type")}
                </Button>
            </Stack>
        </>
    );
}
