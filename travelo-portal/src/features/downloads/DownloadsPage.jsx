import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import { authSliceData } from "../auth/authSlice";

const formatSize = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("hr-HR");
};

export default function DownloadsPage() {
    const authData = useSelector(authSliceData);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [busyFile, setBusyFile] = useState("");

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
    }), [authData.backendURL]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const r = await api.get("/portal/downloads/list");
            // Gateway odmata jedan sloj odgovora, pa lista može doći i top-level i pod .data.
            setItems(r?.data?.downloads ?? r?.data?.data?.downloads ?? []);
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Dohvat popisa nije uspio.");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => { load(); }, [load]);

    // Datoteka ide kroz gateway koji traži prijavu, pa je ne možemo otvoriti
    // običnim linkom — dohvaća se s kolačićem pa sprema iz memorije.
    const download = async (item) => {
        setBusyFile(item.file);
        setError("");
        try {
            const r = await api.get(`/portal/downloads/file/${encodeURIComponent(item.file)}`, {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = item.file;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            setError(`Preuzimanje "${item.title}" nije uspjelo: ${e?.message || "greška"}`);
        } finally {
            setBusyFile("");
        }
    };

    const categories = useMemo(() => {
        const map = new Map();
        for (const it of items) {
            const key = it.category || "Ostalo";
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(it);
        }
        return [...map.entries()];
    }, [items]);

    return (
        <Box sx={{ p: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>Preuzimanja</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Instalacijski paketi, upute i ostali dokumenti
                    </Typography>
                </Box>
                <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
                    Osvježi
                </Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            {loading && items.length === 0 && (
                <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
            )}

            {!loading && items.length === 0 && (
                <Alert severity="info">
                    Nema datoteka za preuzimanje. Datoteke se kopiraju u mapu <b>downloads</b> na poslužitelju
                    (travelo-web_portal-service), a naslovi i opisi se upisuju u <b>downloads.json</b>.
                </Alert>
            )}

            <Stack spacing={2}>
                {categories.map(([category, list]) => (
                    <Paper key={category} sx={{ p: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>{category}</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Stack divider={<Divider flexItem />}>
                            {list.map((item) => (
                                <Stack
                                    key={item.file}
                                    direction={{ xs: "column", sm: "row" }}
                                    alignItems={{ xs: "flex-start", sm: "center" }}
                                    justifyContent="space-between"
                                    spacing={1}
                                    sx={{ py: 1.25 }}
                                >
                                    <Box sx={{ minWidth: 0 }}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                            <Typography fontWeight={600}>{item.title}</Typography>
                                            {item.version && <Chip size="small" label={`v${item.version}`} />}
                                        </Stack>
                                        {item.description && (
                                            <Typography variant="body2" color="text.secondary">
                                                {item.description}
                                            </Typography>
                                        )}
                                        <Typography variant="caption" color="text.secondary">
                                            {item.file} · {formatSize(item.size)} · {formatDate(item.updated_at)}
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        startIcon={busyFile === item.file ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                                        onClick={() => download(item)}
                                        disabled={!!busyFile}
                                    >
                                        Preuzmi
                                    </Button>
                                </Stack>
                            ))}
                        </Stack>
                    </Paper>
                ))}
            </Stack>
        </Box>
    );
}
