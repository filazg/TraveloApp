import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
    Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack,
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

const razlogTekst = (reason) => ({
    ok: "Uspješna prijava",
    bad_user: "Nepoznat korisnik",
    bad_password: "Kriva lozinka",
}[reason] || reason || "");

export default function LoginLogsPage() {
    const authData = useSelector(authSliceData);
    const username = authData?.loggedUserData?.username;

    const [logs, setLogs] = useState([]);
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
            const r = await api.post("/portal/admin/login_logs", {});
            setLogs(r?.data?.logs ?? r?.data?.data?.logs ?? []);
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
                    <Typography variant="h5" fontWeight={800}>Prijave na sustav</Typography>
                    <Typography variant="body2" color="text.secondary">Prijave portal korisnika — uspješne i neuspjele</Typography>
                </Box>
                <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Osvježi</Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Paper sx={{ p: 1 }}>
                {loading && logs.length === 0 ? (
                    <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
                ) : logs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nema zapisa.</Typography>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Vrijeme</TableCell>
                                <TableCell>Korisnik</TableCell>
                                <TableCell>Ishod</TableCell>
                                <TableCell>IP</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.map((l) => (
                                <TableRow key={l.id} hover>
                                    <TableCell>{formatDate(l.createdAt)}</TableCell>
                                    <TableCell>{l.username}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            color={l.success ? "success" : "error"}
                                            label={razlogTekst(l.reason)}
                                        />
                                    </TableCell>
                                    <TableCell>{l.ip_address || "—"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Paper>
        </Box>
    );
}
