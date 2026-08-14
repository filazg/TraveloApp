import {
    Box,
    Button,
    Drawer,
    MenuItem,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState } from "react";
import {
    backofficeSliceData,
    getBackofficeThunk,
    patchBackofficeThunk,
    postBackofficeThunk,
} from "../../../backoffice/backofficeSlice";
import { setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";

// Predefinirani organisation-level mapping ključevi.
const ORG_MAPPINGS = [
    { key: "VAT", label: "PDV obračunan", direction: "credit" },
    { key: "HARBOR_TAX", label: "Lučka pristojba (prihod)", direction: "credit" },
    { key: "NET_REVENUE", label: "Prihod od karata (netto)", direction: "credit" },
    { key: "PREDUJAM", label: "Predujam (buduće obr. razdoblje)", direction: "credit" },
];

export default function AccountsPage() {
    const dispatch = useDispatch();
    const data = useSelector(backofficeSliceData);

    const [tab, setTab] = useState("accounts");
    const [openAdd, setOpenAdd] = useState(false);
    const [newData, setNewData] = useState({});
    const [selectedRow, setSelectedRow] = useState(null);

    const accounts = data.backofficeData?.accounts || [];
    const mappings = data.backofficeData?.account_mappings || [];
    const paymentMethods = data.backofficeData?.payment_methods || [];

    const sync = async () => {
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(setAuthData({ path: "loadingMessage", value: "Učitavanje konta" }));
        await dispatch(getBackofficeThunk({ path: "accounts" }));
        await dispatch(getBackofficeThunk({ path: "account_mappings" }));
        await dispatch(getBackofficeThunk({ path: "payment_methods" }));
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    useEffect(() => {
        sync();
    }, []);

    const accountsByUuid = useMemo(() => {
        const m = {};
        for (const a of accounts) m[a.uuid] = a;
        return m;
    }, [accounts]);

    const mappingByKey = useMemo(() => {
        const m = {};
        for (const r of mappings) m[r.mapping_key] = r;
        return m;
    }, [mappings]);

    const columns = [
        { field: "code", headerName: "Šifra", flex: 1 },
        { field: "name", headerName: "Naziv", flex: 3 },
        { field: "description", headerName: "Opis", flex: 3 },
        {
            field: "is_active",
            headerName: "Aktivan",
            flex: 1,
            type: "boolean",
        },
    ];

    const handleAdd = async () => {
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(postBackofficeThunk({ path: "accounts", data: newData }));
        setOpenAdd(false);
        setNewData({});
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    const handleEdit = async () => {
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(
            patchBackofficeThunk({ path: "accounts", data: selectedRow }),
        );
        setSelectedRow(null);
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    const handleToggleActive = async (row) => {
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(
            patchBackofficeThunk({ path: "accounts", data: { ...row, is_active: !row.is_active } }),
        );
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    const rowActions = useRowClickActions({
        onEdit: (row) => setSelectedRow(row),
        onToggle: handleToggleActive,
    });

    const handleSetMapping = async (mappingKey, accountUuid, direction) => {
        if (!accountUuid) return;
        await dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(
            postBackofficeThunk({
                path: "account_mappings",
                data: {
                    mapping_key: mappingKey,
                    account_uuid: accountUuid,
                    direction,
                },
            }),
        );
        await dispatch(setAuthData({ path: "loading", value: false }));
    };

    return (
        <Box sx={{ width: "98%", ml: 2, mt: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab value="accounts" label="Šifarnik konta" />
                <Tab value="mappings" label="Mapiranja" />
            </Tabs>

            {tab === "accounts" && (
                <>
                    <GridHint />
                    <Box sx={{ height: "75vh", minWidth: 800 }}>
                        <DataGrid
                            rows={accounts}
                            columns={columns}
                            getRowId={(r) => r.id}
                            {...rowActions}
                        />
                    </Box>
                    <Stack alignItems="flex-start" sx={{ mt: 1 }}>
                        <Button onClick={() => setOpenAdd(true)}>+ Dodaj konto</Button>
                    </Stack>
                </>
            )}

            {tab === "mappings" && (
                <Box sx={{ maxWidth: 800 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Globalna mapiranja
                    </Typography>
                    <Stack spacing={2}>
                        {ORG_MAPPINGS.map((m) => {
                            const current = mappingByKey[m.key];
                            return (
                                <Stack key={m.key} direction="row" spacing={2} alignItems="center">
                                    <Typography sx={{ minWidth: 220 }}>{m.label}</Typography>
                                    <TextField
                                        select
                                        size="small"
                                        sx={{ minWidth: 350 }}
                                        value={current?.account_uuid || ""}
                                        onChange={(e) =>
                                            handleSetMapping(m.key, e.target.value, m.direction)
                                        }
                                    >
                                        <MenuItem value="">— odaberi konto —</MenuItem>
                                        {accounts.map((a) => (
                                            <MenuItem key={a.uuid} value={a.uuid}>
                                                {a.code} — {a.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Stack>
                            );
                        })}
                    </Stack>

                    <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
                        Načini plaćanja → konto (debit)
                    </Typography>
                    <Stack spacing={2}>
                        {paymentMethods.map((pm) => {
                            const key = `PAYMENT:${pm.uuid}`;
                            const current = mappingByKey[key];
                            return (
                                <Stack key={pm.uuid} direction="row" spacing={2} alignItems="center">
                                    <Typography sx={{ minWidth: 220 }}>{pm.name}</Typography>
                                    <TextField
                                        select
                                        size="small"
                                        sx={{ minWidth: 350 }}
                                        value={current?.account_uuid || ""}
                                        onChange={(e) =>
                                            handleSetMapping(key, e.target.value, "debit")
                                        }
                                    >
                                        <MenuItem value="">— odaberi konto —</MenuItem>
                                        {accounts.map((a) => (
                                            <MenuItem key={a.uuid} value={a.uuid}>
                                                {a.code} — {a.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Stack>
                            );
                        })}
                        {paymentMethods.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                Nema definiranih načina plaćanja.
                            </Typography>
                        )}
                    </Stack>
                </Box>
            )}

            <Drawer
                anchor="right"
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 480 } } }}
            >
                <Box sx={{ mx: 4, my: 3 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">
                            Novi konto
                        </Typography>
                        <Button onClick={() => setOpenAdd(false)}>Zatvori</Button>
                    </Stack>
                    <TextField
                        fullWidth
                        required
                        label="Šifra konta"
                        value={newData.code || ""}
                        onChange={(e) => setNewData({ ...newData, code: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        required
                        label="Naziv"
                        value={newData.name || ""}
                        onChange={(e) => setNewData({ ...newData, name: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label="Opis"
                        value={newData.description || ""}
                        onChange={(e) =>
                            setNewData({ ...newData, description: e.target.value })
                        }
                        sx={{ mt: 1 }}
                    />
                    <Button
                        onClick={handleAdd}
                        variant="contained"
                        disabled={!newData.code || !newData.name}
                        sx={{ height: 60, mt: 2, width: "100%" }}
                    >
                        Spremi
                    </Button>
                </Box>
            </Drawer>

            <Drawer
                anchor="right"
                open={!!selectedRow}
                onClose={() => setSelectedRow(null)}
                PaperProps={{ sx: { width: { xs: "100vw", sm: 480 } } }}
            >
                <Box sx={{ mx: 4, my: 3 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">
                            Uredi konto
                        </Typography>
                        <Button onClick={() => setSelectedRow(null)}>Zatvori</Button>
                    </Stack>
                    <TextField
                        fullWidth
                        required
                        label="Šifra konta"
                        value={selectedRow?.code || ""}
                        onChange={(e) =>
                            setSelectedRow({ ...selectedRow, code: e.target.value })
                        }
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        required
                        label="Naziv"
                        value={selectedRow?.name || ""}
                        onChange={(e) =>
                            setSelectedRow({ ...selectedRow, name: e.target.value })
                        }
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label="Opis"
                        value={selectedRow?.description || ""}
                        onChange={(e) =>
                            setSelectedRow({ ...selectedRow, description: e.target.value })
                        }
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        select
                        label="Aktivan"
                        value={selectedRow?.is_active ? "true" : "false"}
                        onChange={(e) =>
                            setSelectedRow({
                                ...selectedRow,
                                is_active: e.target.value === "true",
                            })
                        }
                        sx={{ mt: 1 }}
                    >
                        <MenuItem value="true">Da</MenuItem>
                        <MenuItem value="false">Ne</MenuItem>
                    </TextField>
                    <Button
                        onClick={handleEdit}
                        variant="contained"
                        sx={{ height: 60, mt: 2, width: "100%" }}
                    >
                        Spremi promjene
                    </Button>
                </Box>
            </Drawer>
        </Box>
    );
}
