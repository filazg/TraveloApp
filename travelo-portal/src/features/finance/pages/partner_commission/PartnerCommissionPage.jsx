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
    // ovdje i ne prikazuje se uz tablicu; spominje se samo kad nema prodaje, da
    // se vidi za što je obračun bio prazan.
    const from = obracun.from || "";
    const to = obracun.to || "";

    // Otvoreno razdoblje — ono koje jos traje. Stoji uz obracun kao stanje, ne
    // kao podloga za isplatu: iznos nije konacan jer se prodaja jos dogadja.
    const otvoreno = finance.partnerCommissionOpen || {};
    const otvoreniPartner = (otvoreno.partners || [])[0] || null;

    // Kartica u Financijama pali zaslon učitavanja prije nego preda stranicu, pa
    // ga stranica mora ugasiti — inače prekrivač ostane preko svega i izgleda
    // kao da se ništa nije otvorilo.
    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        dispatch(fetchPartnersListThunk());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const trazi = async () => {
        // Obračun se radi za jednog partnera. Zajednički prikaz nema smisla: svaki
        // partner ima svoju dinamiku, pa i svoje razdoblje, i ne mogu stajati
        // jedan pored drugoga kao da su obračunati na isti dan.
        if (!partnerUuid) return;
        dispatch(setAuthData({ path: "loadingMessage", value: "Obračun provizije…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        // Dva razdoblja idu usporedno: zaokruzeno (za isplatu) i otvoreno (stanje).
        await Promise.all([
            dispatch(fetchPartnerCommissionThunk({ partner_uuid: partnerUuid })),
            dispatch(fetchPartnerCommissionThunk({ partner_uuid: partnerUuid, period: "current" })),
        ]);
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
                        required
                        value={partnerUuid}
                        onChange={(e) => setPartnerUuid(e.target.value)}
                        sx={{ minWidth: 260 }}
                    >
                        {(finance.partnersList || []).map((p) => (
                            <MenuItem key={p.uuid} value={p.uuid}>{p.partner_name}</MenuItem>
                        ))}
                    </TextField>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={trazi}
                        disabled={finance.partnerCommissionLoading || !partnerUuid}
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Razdoblje se određuje iz dinamike naplate partnera. Obuhvaćena je prodaja s prodajnih
                    mjesta označenih kao partnerska, po datumu izdavanja karte. Provizija se računa na neto
                    osnovicu — bez lučke pristojbe i bez PDV-a.
                </Typography>
            </Paper>

            {finance.partnerCommissionError ? (
                <Alert severity="error" sx={{ mb: 2 }}>{finance.partnerCommissionError}</Alert>
            ) : null}

            {!partnerUuid ? (
                <Alert severity="info">
                    Odaberi partnera. Obračun se radi za jednog partnera, za razdoblje koje proizlazi
                    iz njegove dinamike naplate.
                </Alert>
            ) : null}

            {partnerUuid && !partneri.length && !finance.partnerCommissionLoading ? (
                <Alert severity="info">
                    Nema prodaje u obračunskom razdoblju{from && to ? ` (${hrDatum(from)} – ${hrDatum(to)})` : ""}.
                    Provjeri je li prodajno mjesto u Administraciji označeno kao partnersko i vezano na
                    ovog partnera, i pada li prodaja u to razdoblje — obračunava se zadnje zaokruženo
                    razdoblje, ne ono koje traje.
                </Alert>
            ) : null}

            {partnerUuid && otvoreniPartner ? (
                <Paper variant="outlined" sx={{ mb: 2, borderColor: "warning.main" }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
                    >
                        <Typography sx={{ fontWeight: 800, flex: 1 }}>
                            Otvoreno razdoblje{otvoreno.from && otvoreno.to
                                ? ` · ${hrDatum(otvoreno.from)} – ${hrDatum(otvoreno.to)}` : ""}
                        </Typography>
                        <Chip size="small" color="warning" label="u tijeku — nije za isplatu" />
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
                                {(otvoreniPartner.premises || []).map((m) => (
                                    <TableRow key={`open-${m.business_premise_uuid}`} hover>
                                        <TableCell>{m.business_premise_name}</TableCell>
                                        <TableCell align="right">{m.tickets}</TableCell>
                                        <TableCell align="right">{fmtEUR(m.gross)}</TableCell>
                                        <TableCell align="right">{fmtEUR(m.base)}</TableCell>
                                        <TableCell align="right">{fmtEUR(m.commission)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800 }}>Dosad u ovom razdoblju</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{otvoreniPartner.tickets}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(otvoreniPartner.gross)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(otvoreniPartner.base)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 900 }}>{fmtEUR(otvoreniPartner.commission)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            ) : null}

            {partneri.length ? (
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    Obračun{from && to ? ` · ${hrDatum(from)} – ${hrDatum(to)}` : ""}
                </Typography>
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

        </Box>
    );
}
