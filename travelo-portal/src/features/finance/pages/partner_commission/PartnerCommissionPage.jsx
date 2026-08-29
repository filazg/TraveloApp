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

// Jedna kartica po razdoblju, a unutar nje dvije razrade, jer partneru promet
// dolazi iz dva izvora i taj se novac ne obračunava isto:
//
//  1. za naš račun — karte prodane u naše ime, na partnerskom prodajnom mjestu.
//     Novac je naš, partneru dugujemo proviziju. Razrada ide do naplatnog
//     uređaja i operatera, jer su to njegovi ljudi na našoj opremi.
//  2. za vlastiti račun — karte prodane kroz partnersku prodaju. Njih partner
//     naplaćuje sam, a provizija mu se odbija na zbirnom računu. Razrada ide po
//     njegovim korisnicima.
function ObracunKartica({ naslov, oznaka, oznakaBoja, podaci, nazivTvrtke, istaknuto }) {
    const partner = (podaci.partners || [])[0] || null;
    const kanal = podaci.partner_channel || null;
    if (!partner && !kanal) return null;

    return (
        <Paper
            variant="outlined"
            sx={{ mb: 2, ...(istaknuto ? { borderColor: "warning.main" } : null) }}
        >
            <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
            >
                <Typography sx={{ fontWeight: 800, flex: 1 }}>
                    {naslov}
                    {podaci.from && podaci.to ? ` · ${hrDatum(podaci.from)} – ${hrDatum(podaci.to)}` : ""}
                </Typography>
                {oznaka ? <Chip size="small" color={oznakaBoja} label={oznaka} /> : null}
            </Stack>

            {/* ---- 1. ZA NAŠ RAČUN ---- */}
            {partner ? (
                <Box>
                    <Typography sx={{ px: 2, pt: 2, pb: 1, fontWeight: 700 }}>
                        Za račun {nazivTvrtke || "tvrtke"}
                    </Typography>
                    <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Prodajno mjesto</TableCell>
                                    <TableCell>Naplatni uređaj</TableCell>
                                    <TableCell>Operater</TableCell>
                                    <TableCell align="right">Karata</TableCell>
                                    <TableCell align="right">Promet</TableCell>
                                    <TableCell align="right">Osnovica</TableCell>
                                    <TableCell align="right">Provizija</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(partner.premises || []).map((m) => (
                                    (m.rows || []).map((r, i) => (
                                        <TableRow key={`${m.business_premise_uuid}-${r.billing_device}-${r.operator}`} hover>
                                            {/* Naziv mjesta stoji samo uz prvi redak, da se ne ponavlja
                                                niz cijeli stupac. */}
                                            <TableCell>{i === 0 ? m.business_premise_name : ""}</TableCell>
                                            <TableCell>{r.billing_device || "—"}</TableCell>
                                            <TableCell>{r.operator || "—"}</TableCell>
                                            <TableCell align="right">{r.tickets}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.base)}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                                        </TableRow>
                                    ))
                                ))}
                                <TableRow>
                                    <TableCell colSpan={3} sx={{ fontWeight: 800 }}>Ukupno za naš račun</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{partner.tickets}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(partner.gross)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(partner.base)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 900 }}>{fmtEUR(partner.commission)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            ) : null}

            {/* ---- 2. ZA VLASTITI RAČUN PARTNERA ---- */}
            {kanal ? (
                <Box sx={{ mt: partner ? 2 : 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 2, pb: 1 }}>
                        <Typography sx={{ fontWeight: 700, flex: 1 }}>
                            Za vlastiti račun partnera
                        </Typography>
                        <Chip size="small" label={`na zbirnom računu: ${kanal.invoiced}/${kanal.tickets}`} />
                    </Stack>
                    <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Korisnik</TableCell>
                                    <TableCell align="right">Karata</TableCell>
                                    <TableCell align="right">Promet</TableCell>
                                    <TableCell align="right">Osnovica</TableCell>
                                    <TableCell align="right">Provizija</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(kanal.rows || []).map((r) => (
                                    <TableRow key={`kanal-${r.username}`} hover>
                                        <TableCell>{r.username}</TableCell>
                                        <TableCell align="right">{r.tickets}</TableCell>
                                        <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                        <TableCell align="right">{fmtEUR(r.base)}</TableCell>
                                        <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800 }}>Ukupno za vlastiti račun</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{kanal.tickets}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(kanal.gross)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(kanal.base)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 900 }}>{fmtEUR(kanal.commission)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
                        Karte koje je partner prodao kroz partnersku prodaju. Njih naplaćuje od putnika, a
                        provizija mu se odbija na zbirnom računu — zato se ne isplaćuju kroz ovaj obračun.
                    </Typography>
                </Box>
            ) : null}
        </Paper>
    );
}

export default function PartnerCommissionPage() {
    const dispatch = useDispatch();
    const finance = useSelector(financeSliceData);

    const [partnerUuid, setPartnerUuid] = useState("");

    const obracun = finance.partnerCommission || {};
    const partneri = obracun.partners || [];
    const totals = obracun.totals || { tickets: 0, gross: 0, base: 0, commission: 0 };
    // Razdoblje dolazi s poslužitelja, iz dinamike naplate partnera — ne bira se
    // ovdje; spominje se u poruci kad nema prodaje, da se vidi za što je obračun
    // bio prazan.
    const from = obracun.from || "";
    const to = obracun.to || "";

    // Otvoreno razdoblje — ono koje još traje. Stoji uz obračun kao stanje, ne
    // kao podloga za isplatu: iznos nije konačan jer se prodaja još događa.
    const otvoreno = finance.partnerCommissionOpen || {};

    const nazivTvrtke = obracun.company_name || otvoreno.company_name || "";
    const odabraniPartner = useMemo(
        () => (finance.partnersList || []).find((p) => p.uuid === partnerUuid) || null,
        [finance.partnersList, partnerUuid]
    );

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
        // Dva razdoblja idu usporedno: zaokruženo (za isplatu) i otvoreno (stanje).
        await Promise.all([
            dispatch(fetchPartnerCommissionThunk({ partner_uuid: partnerUuid })),
            dispatch(fetchPartnerCommissionThunk({ partner_uuid: partnerUuid, period: "current" })),
        ]);
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const nemaNista = !partneri.length && !obracun.partner_channel;

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
                        onClick={() => izveziObracunProvizije({ partneri, totals, from, to, partner: odabraniPartner })}
                        disabled={!partneri.length}
                    >
                        Excel
                    </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Razdoblje se određuje iz dinamike naplate partnera. Provizija se računa na neto
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

            {partnerUuid ? (
                <>
                    <ObracunKartica
                        naslov="Obračun"
                        oznaka="za isplatu"
                        oznakaBoja="primary"
                        podaci={obracun}
                        nazivTvrtke={nazivTvrtke}
                    />
                    <ObracunKartica
                        naslov="Otvoreno razdoblje"
                        oznaka="u tijeku — nije za isplatu"
                        oznakaBoja="warning"
                        podaci={otvoreno}
                        nazivTvrtke={nazivTvrtke}
                        istaknuto
                    />
                </>
            ) : null}

            {partnerUuid && nemaNista && !finance.partnerCommissionLoading ? (
                <Alert severity="info">
                    Nema prodaje u obračunskom razdoblju{from && to ? ` (${hrDatum(from)} – ${hrDatum(to)})` : ""}.
                    Obračunava se zadnje zaokruženo razdoblje, ne ono koje traje.
                </Alert>
            ) : null}
        </Box>
    );
}
