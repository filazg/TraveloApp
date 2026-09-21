import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
    Alert, Box, Button, Chip, CircularProgress, Paper, Stack,
    Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { authSliceData } from "../auth/authSlice";

const ADMIN_USER = "nfilipec";

const formatDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR");
};

export default function DevicesPage() {
    const authData = useSelector(authSliceData);
    const username = authData?.loggedUserData?.username;

    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
    }), [authData.backendURL]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const r = await api.post("/portal/admin/device_connections", {});
            setDevices(r?.data?.devices ?? r?.data?.data?.devices ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Dohvat nije uspio.");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => { if (username === ADMIN_USER) load(); }, [username, load]);

    if (username !== ADMIN_USER) {
        return <Box sx={{ p: 2 }}><Alert severity="error">Pristup je ograničen.</Alert></Box>;
    }

    return (
        <Box sx={{ p: 2, width: "100%", maxWidth: 1000 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>Uređaji i verzije</Typography>
                    <Typography variant="body2" color="text.secondary">Zadnje stanje po uređaju — s kojom se verzijom spaja</Typography>
                </Box>
                <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Osvježi</Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Paper sx={{ p: 1 }}>
                {loading && devices.length === 0 ? (
                    <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
                ) : devices.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nijedan uređaj se još nije javio.</Typography>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Uređaj (TID)</TableCell>
                                <TableCell>Klijent</TableCell>
                                <TableCell>Verzija</TableCell>
                                <TableCell>Zadnji put viđen</TableCell>
                                <TableCell>IP</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {devices.map((d) => (
                                <TableRow key={d.tid} hover>
                                    <TableCell>{d.tid}</TableCell>
                                    <TableCell>
                                        {d.client
                                            ? <Chip size="small" label={d.client} variant="outlined" />
                                            : "—"}
                                    </TableCell>
                                    <TableCell><b>{d.app_version || "—"}</b></TableCell>
                                    <TableCell>{formatDate(d.last_seen)}</TableCell>
                                    <TableCell>{d.ip_address || "—"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Paper>
        </Box>
    );
}
