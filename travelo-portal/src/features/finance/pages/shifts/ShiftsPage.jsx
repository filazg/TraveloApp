import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert, Box, Button, Chip, Drawer, MenuItem, Stack, TextField } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import {
    fetchShiftsThunk,
    financeSliceData,
    setShiftsFilter,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import ShiftPreviewDrawer from "./ShiftPreviewDrawer";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmtDateTime = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString("hr-HR");
};

export default function ShiftsPage() {
    const dispatch = useDispatch();
    const { shifts, shiftsLoading, shiftsError, shiftsFilters } = useSelector(financeSliceData);
    const [selectedShift, setSelectedShift] = useState(null);
    const clickTimerRef = useRef(null);

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        dispatch(fetchShiftsThunk({ from: shiftsFilters.from, to: shiftsFilters.to }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const handleSearch = async () => {
        const params = {};
        if (shiftsFilters.from) params.from = shiftsFilters.from;
        if (shiftsFilters.to) params.to = shiftsFilters.to;
        if (shiftsFilters.operater_username) params.operater_username = shiftsFilters.operater_username;
        if (shiftsFilters.billing_device_uuid) params.billing_device_uuid = shiftsFilters.billing_device_uuid;
        if (shiftsFilters.shift_open) params.shift_open = shiftsFilters.shift_open;
        dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat smjena…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchShiftsThunk(params));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const columns = useMemo(
        () => [
            {
                field: "shift_start",
                headerName: "Početak",
                width: 160,
                valueFormatter: (v) => fmtDateTime(v),
            },
            {
                field: "shift_end",
                headerName: "Završetak",
                width: 160,
                valueFormatter: (v) => fmtDateTime(v),
            },
            {
                field: "operater",
                headerName: "Operater",
                flex: 2,
                minWidth: 160,
                valueGetter: (_v, row) => `${row.operater_name || ""} ${row.operater_surname || ""}`.trim() || row.operater_username || "—",
            },
            { field: "operater_username", headerName: "Username", width: 130 },
            { field: "billing_device_fiscal_mark", headerName: "Uređaj", width: 90 },
            { field: "shift_first_invoice", headerName: "Prvi račun", width: 120 },
            { field: "shift_last_invoice", headerName: "Zadnji račun", width: 120 },
            {
                field: "shift_amount",
                headerName: "Promet",
                width: 120,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "shift_vat_base",
                headerName: "Osnovica",
                width: 110,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "shift_vat",
                headerName: "PDV",
                width: 100,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "shift_harbor_tax",
                headerName: "Luč. pristojba",
                width: 120,
                align: "right",
                headerAlign: "right",
                valueFormatter: (v) => fmtEUR(v),
            },
            {
                field: "shift_open",
                headerName: "Status",
                width: 130,
                renderCell: (params) => (
                    <Box
                        sx={{
                            width: "100%",
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 12,
                            py: 0.5,
                            borderRadius: 0.5,
                            color: params.value ? "#854d0e" : "#1b5e20",
                            backgroundColor: params.value ? "#fef9c3" : "#c8e6c9",
                        }}
                    >
                        {params.value ? "Otvorena" : "Zatvorena"}
                    </Box>
                ),
            },
        ],
        []
    );

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Stack direction="row" spacing={2} sx={{ my: 2, flexWrap: "wrap" }} alignItems="center">
                <TextField
                    type="date"
                    label="Od"
                    InputLabelProps={{ shrink: true }}
                    value={shiftsFilters.from}
                    onChange={(e) => dispatch(setShiftsFilter({ path: "from", value: e.target.value }))}
                    sx={{ width: 180 }}
                />
                <TextField
                    type="date"
                    label="Do"
                    InputLabelProps={{ shrink: true }}
                    value={shiftsFilters.to}
                    onChange={(e) => dispatch(setShiftsFilter({ path: "to", value: e.target.value }))}
                    sx={{ width: 180 }}
                />
                <TextField
                    label="Operater (username)"
                    value={shiftsFilters.operater_username}
                    onChange={(e) => dispatch(setShiftsFilter({ path: "operater_username", value: e.target.value }))}
                    sx={{ width: 220 }}
                />
                <TextField
                    select
                    label="Status"
                    value={shiftsFilters.shift_open}
                    onChange={(e) => dispatch(setShiftsFilter({ path: "shift_open", value: e.target.value }))}
                    sx={{ width: 180 }}
                >
                    <MenuItem value="">— svi —</MenuItem>
                    <MenuItem value="true">Otvorene</MenuItem>
                    <MenuItem value="false">Zatvorene</MenuItem>
                </TextField>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={handleSearch}
                    disabled={shiftsLoading}
                    sx={{ height: 56, px: 3 }}
                >
                    Pretraži
                </Button>
                <Chip label={`${shifts.length} rezultata`} />
            </Stack>

            {shiftsError && <Alert severity="error" sx={{ mb: 2 }}>{shiftsError}</Alert>}

            <Box sx={{ height: "75vh", minWidth: 1400 }}>
                <DataGrid
                    rows={shifts}
                    getRowId={(r) => r.shift_uuid}
                    columns={columns}
                    loading={shiftsLoading}
                    initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    disableRowSelectionOnClick
                    onCellClick={(params) => {
                        clearTimeout(clickTimerRef.current);
                        clickTimerRef.current = setTimeout(() => {
                            setSelectedShift(params.row);
                        }, 200);
                    }}
                    sx={{ "& .MuiDataGrid-row:hover": { cursor: "pointer" } }}
                />
            </Box>

            <Drawer
                anchor="right"
                open={!!selectedShift}
                onClose={() => setSelectedShift(null)}
                PaperProps={{
                    sx: { height: "100%", maxWidth: "100vw", overflow: "hidden" },
                }}
            >
                <ShiftPreviewDrawer
                    shift={selectedShift}
                    onClose={() => setSelectedShift(null)}
                />
            </Drawer>
        </Box>
    );
}
