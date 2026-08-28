import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import { fetchPartnerCommissionThunk, fetchPartnersListThunk, financeSliceData } from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import { izveziObracunProvizije } from "./provizijaExcel";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

const hrDatum = (isoDatum) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDatum || ""));
    return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(isoDatum || "");
};

export default function PartnerCommissionPage() {
    const dispatch = useDispatch();
    const finance = useSelector(financeSliceData);

    const [partnerUuid, setPartnerUuid] = useState("");

    const obracun = finance.partnerCommission || {};
    const partneri = obracun.partners || [];
    const totals = obracun.totals || { tickets: 0, gross: 0, base: 0, commission: 0 };
    // Razdoblje dolazi s poslužitelja, iz dinamike naplate partnera — ne bira se
    // ovdje, da obračun ne ovisi o tome što je netko upisao.
    const from = obracun.from || "";
    const to = obracun.to || "";
    const razdoblje = obracun.period || null;

    // Kartica u Financijama pali zaslon učitavanja prije nego preda stranicu, pa
    // ga stranica mora ugasiti — inače prekrivač ostane preko svega i izgleda
    // kao da se ništa nije otvorilo.
    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        dispatch(fetchPartnersListThunk());
        dispatch(fetchPartnerCommissionThunk({}));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const trazi = async () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Obračun provizije…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        await dispatch(fetchPartnerCommissionThunk(
            partnerUuid ? { partner_uuid: partnerUuid } : {}
        ));
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const partnerZaIzvoz = useMemo(
        () => (finance.partnersList || []).find((p) => p.uuid === partnerUuid) || null,
        [finance.partnersList, partnerUuid]
    );

    return (
        // Puna sirina kao i ostali prikazi u Financijama.
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                Obračun provizije partnerima
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                    <TextField
                        select
                        size="small"
                        label="Partner"
                        value={partnerUuid}
                        onChange={(e) => setPartnerUuid(e.target.value)}
                        sx={{ minWidth: 260 }}
                    >
                        <MenuItem value="">— svi partneri —</MenuItem>
                        {(finance.partnersList || []).map((p) => (
                            <MenuItem key={p.uuid} value={p.uuid}>{p.partner_name}</MenuItem>
                        ))}
                    </TextField>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={trazi}
                        disabled={finance.partnerCommissionLoading}
                    >
                        Prikaži
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => izveziObracunProvizije({ partneri, totals, from, to, partner: partnerZaIzvoz })}
                        disabled={!partneri.length}
                    >
                        Excel
                    </Button>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5, flexWrap: "wrap" }} useFlexGap>
                    {from && to ? (
                        <Chip
                            color="primary"
                            variant="outlined"
                            label={`Razdoblje: ${hrDatum(from)} – ${hrDatum(to)}`}
                            sx={{ fontWeight: 700 }}
                        />
                    ) : null}
                    {razdoblje?.label ? <Chip size="small" label={razdoblje.label} /> : null}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Razdoblje se određuje iz dinamike naplate partnera. Obuhvaćena je prodaja s prodajnih
                    mjesta označenih kao partnerska, po datumu izdavanja karte. Provizija se računa na neto
                    osnovicu — bez lučke pristojbe i bez PDV-a.
                </Typography>
            </Paper>

            {finance.partnerCommissionError ? (
                <Alert severity="error" sx={{ mb: 2 }}>{finance.partnerCommissionError}</Alert>
            ) : null}

            {!partneri.length && !finance.partnerCommissionLoading ? (
                <Alert severity="info">
                    Nema prodaje za odabrano razdoblje. Provjeri je li prodajno mjesto u Administraciji
                    označeno kao partnersko i vezano na partnera.
                </Alert>
            ) : null}

            {partneri.map((p) => (
                <Paper key={p.partner_uuid} variant="outlined" sx={{ mb: 2 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
                    >
                        <Typography sx={{ fontWeight: 800, flex: 1 }}>{p.partner_name}</Typography>
                        {p.partner_legal_id ? <Chip size="small" label={`OIB ${p.partner_legal_id}`} /> : null}
                        <Chip size="small" color="primary" label={`provizija ${Number(p.commission_pct)} %`} />
                    </Stack>

                    <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Prodajno mjesto</TableCell>
                                    <TableCell align="right">Karata</TableCell>
                                    <TableCell align="right">Promet</TableCell>
                                    <TableCell align="right">Osnovica</TableCell>
                                    <TableCell align="right">Provizija</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(p.premises || []).map((m) => (
                                    <TableRow key={m.business_premise_uuid} hover>
                                        <TableCell>{m.business_premise_name}</TableCell>
                                        <TableCell align="right">{m.tickets}</TableCell>
                                        <TableCell align="right">{fmtEUR(m.gross)}</TableCell>
                                        <TableCell align="right">{fmtEUR(m.base)}</TableCell>
                                        <TableCell align="right">{fmtEUR(m.commission)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800 }}>Ukupno za partnera</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{p.tickets}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(p.gross)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(p.base)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 900 }}>{fmtEUR(p.commission)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            ))}

            {partneri.length > 1 ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={4} justifyContent="flex-end">
                        <Typography sx={{ fontWeight: 700 }}>Karata: {totals.tickets}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>Promet: {fmtEUR(totals.gross)}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>Osnovica: {fmtEUR(totals.base)}</Typography>
                        <Typography sx={{ fontWeight: 900 }}>Provizija: {fmtEUR(totals.commission)}</Typography>
                    </Stack>
                </Paper>
            ) : null}
        </Box>
    );
}
