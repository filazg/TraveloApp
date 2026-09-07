import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, CircularProgress, Drawer, Paper, Stack,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";

import {
    kontrolaSliceData,
    fetchCopyConflictsThunk,
    fetchTicketValidationsThunk,
    fetchCopyPrintsThunk,
    clearDetail,
    setDetailTicket,
} from "../../kontrolaSlice";
import { setAuthData } from "../../../auth/authSlice";

// Vrijeme dolazi kao ISO; prikazuje se u lokalnoj zoni jer se uspoređuje s onim
// što piše na ukrcaju.
const fmtVrijeme = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("hr-HR");
};

const ISHOD = {
    validated: { label: "validirano", color: "success" },
    already_validated: { label: "već validirano", color: "warning" },
    canceled: { label: "stornirana", color: "default" },
    inactive: { label: "neaktivna", color: "default" },
    not_found: { label: "nije nađena", color: "error" },
    error: { label: "greška", color: "error" },
};

// Što je skenirano: original, koja kopija, ili karta bez oznake (starija, prije
// nego su se oznake uvele).
const opisOtiska = (r) => {
    if (r.is_copy === null || r.is_copy === undefined) return "bez oznake";
    if (!r.is_copy) return "original";
    return r.copy_no ? `kopija ${r.copy_no}` : "kopija (broj nečitljiv)";
};

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function TicketCopyControlPage() {
    const dispatch = useDispatch();
    const data = useSelector(kontrolaSliceData);

    const [from, setFrom] = useState(danaUnazad(30));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

    const ucitaj = () => {
        dispatch(fetchCopyConflictsThunk({ from, to }));
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        ucitaj();
        // Prvi dohvat ide samo pri otvaranju; dalje na zahtjev, da se popis ne
        // osvježava pod rukom dok se čita.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    // Ladici se predaje cijeli redak, ne samo uuid: podatke o karti popis je vec
    // dohvatio, pa nema razloga ici po njih drugi put.
    const [odabrana, setOdabrana] = useState(null);
    const otvoriDetalj = (r) => {
        setOdabrana(r);
        dispatch(setDetailTicket(r.ticket_uuid));
        dispatch(fetchTicketValidationsThunk({ ticket_uuid: r.ticket_uuid }));
        dispatch(fetchCopyPrintsThunk({ ticket_uuid: r.ticket_uuid }));
    };
    const zatvoriDetalj = () => {
        setOdabrana(null);
        dispatch(clearDetail());
    };

    const sukobi = data.conflicts || [];

    return (
        <Box sx={{ width: "100%", maxWidth: 1400 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
                <Typography variant="h6" fontWeight={800}>Kontrola kopija karata</Typography>
                <Box sx={{ flex: 1 }} />
                <TextField
                    size="small" type="date" label="Od" InputLabelProps={{ shrink: true }}
                    value={from} onChange={(e) => setFrom(e.target.value)}
                />
                <TextField
                    size="small" type="date" label="Do" InputLabelProps={{ shrink: true }}
                    value={to} onChange={(e) => setTo(e.target.value)}
                />
                <Button variant="contained" startIcon={<RefreshIcon />} onClick={ucitaj}>
                    Osvježi
                </Button>
            </Stack>

            <Alert severity="info" sx={{ mb: 2 }}>
                Popis pokazuje karte kod kojih je na kontroli pokušana validacija drugog
                otiska nego onog koji je već prošao — kopija preko originala, original
                preko kopije ili druga kopija. Ponovno očitanje istog papira nije sukob.
            </Alert>

            {data.conflictsError && (
                <Alert severity="error" sx={{ mb: 2 }}>{data.conflictsError}</Alert>
            )}

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Broj karte</TableCell>
                            <TableCell>Relacija</TableCell>
                            {/* Kada je original izdan — iz toga se vidi je li kopija
                                nastala odmah po prodaji ili danima kasnije. */}
                            <TableCell>Original izdan</TableCell>
                            <TableCell align="right">Sukoba</TableCell>
                            <TableCell>Zadnji sukob</TableCell>
                            <TableCell>Razlog</TableCell>
                            <TableCell>Kontrolor</TableCell>
                            <TableCell>Uređaj</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.conflictsLoading && (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                    <CircularProgress size={22} />
                                </TableCell>
                            </TableRow>
                        )}
                        {!data.conflictsLoading && sukobi.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                                    U odabranom razdoblju nema uhvaćenih sukoba.
                                </TableCell>
                            </TableRow>
                        )}
                        {!data.conflictsLoading && sukobi.map((r) => (
                            <TableRow
                                key={r.ticket_uuid}
                                hover
                                sx={{ cursor: "pointer" }}
                                onClick={() => otvoriDetalj(r)}
                            >
                                <TableCell sx={{ fontWeight: 700 }}>{r.ticket_code || r.ticket_uuid}</TableCell>
                                <TableCell>
                                    {r.departure_harbor_name
                                        ? `${r.departure_harbor_name} → ${r.arrival_harbor_name || ""}`
                                        : "—"}
                                </TableCell>
                                <TableCell>{fmtVrijeme(r.ticket_issued_at)}</TableCell>
                                <TableCell align="right">
                                    <Chip size="small" color="error" label={r.conflict_count} />
                                </TableCell>
                                <TableCell>{fmtVrijeme(r.last_conflict_at)}</TableCell>
                                <TableCell>{r.last_reason || "—"}</TableCell>
                                <TableCell>{r.last_operator || "—"}</TableCell>
                                <TableCell>{r.last_terminal || "—"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Detalj: cijela povijest karte. Sukob se ne da procijeniti iz jednog
                retka — treba se vidjeti što je prošlo prvo i koje su kopije uopće
                izdane. */}
            <Drawer
                anchor="right"
                open={!!data.detailTicketUuid}
                onClose={zatvoriDetalj}
                PaperProps={{ sx: { width: { xs: "100%", md: 720 }, p: 3 } }}
            >
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Typography variant="h6" fontWeight={800}>Povijest karte</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Button startIcon={<CloseIcon />} onClick={zatvoriDetalj}>
                        Zatvori
                    </Button>
                </Stack>

                {/* Podaci o originalu. Bez njih se povijest čita bez uporišta —
                    ne vidi se koja je to karta ni koliko je vremena prošlo od
                    prodaje do prve kopije. */}
                {odabrana && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Stack
                            direction="row"
                            spacing={4}
                            sx={{ flexWrap: "wrap", rowGap: 1.5 }}
                        >
                            {[
                                ["Broj karte", odabrana.ticket_code || odabrana.ticket_uuid],
                                ["Oznaka originala", odabrana.original_suffix || "—"],
                                ["Relacija", odabrana.departure_harbor_name
                                    ? `${odabrana.departure_harbor_name} → ${odabrana.arrival_harbor_name || ""}`
                                    : "—"],
                                ["Linija", odabrana.line_code || "—"],
                                ["Polazak", odabrana.departure || "—"],
                                ["Original izdan", fmtVrijeme(odabrana.ticket_issued_at)],
                            ].map(([oznaka, vrijednost]) => (
                                <Box key={oznaka}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        {oznaka}
                                    </Typography>
                                    <Typography fontWeight={700} fontSize={14}>
                                        {vrijednost}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                    </Paper>
                )}

                <Typography variant="caption" color="text.secondary">Pokušaji validacije</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, mt: 0.5 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Vrijeme</TableCell>
                                <TableCell>Ishod</TableCell>
                                <TableCell>Otisak</TableCell>
                                <TableCell>Kontrolor</TableCell>
                                <TableCell>Napomena</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.detailLoading && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                        <CircularProgress size={20} />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!data.detailLoading && (data.validations || []).map((v) => {
                                const i = ISHOD[v.outcome] || { label: v.outcome, color: "default" };
                                return (
                                    <TableRow key={v.id} sx={v.is_conflict ? { bgcolor: "rgba(179,38,30,0.06)" } : {}}>
                                        <TableCell>{fmtVrijeme(v.validated_at)}</TableCell>
                                        <TableCell><Chip size="small" color={i.color} label={i.label} /></TableCell>
                                        <TableCell>
                                            {opisOtiska(v)}
                                            {v.suffix ? ` · ${v.suffix}` : ""}
                                        </TableCell>
                                        <TableCell>{v.operator || "—"}</TableCell>
                                        <TableCell sx={{ color: v.is_conflict ? "#B3261E" : "text.secondary" }}>
                                            {v.conflict_reason || "—"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {!data.detailLoading && (data.validations || []).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                        Nema zabilježenih pokušaja.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Typography variant="caption" color="text.secondary">Ispisane kopije</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 0.5 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell align="right">Kopija</TableCell>
                                <TableCell>Oznaka</TableCell>
                                <TableCell>Vrijeme</TableCell>
                                <TableCell>Izdao</TableCell>
                                <TableCell>Uređaj</TableCell>
                                <TableCell>Mjesto</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(data.copyPrints || []).map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{c.copy_no}</TableCell>
                                    <TableCell>{c.suffix || "—"}</TableCell>
                                    <TableCell>{fmtVrijeme(c.printed_at)}</TableCell>
                                    <TableCell>{c.operator_name || "—"}</TableCell>
                                    <TableCell>{c.billing_device_name || "—"}</TableCell>
                                    <TableCell>{c.business_premise_name || "—"}</TableCell>
                                </TableRow>
                            ))}
                            {(data.copyPrints || []).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                        Za ovu kartu nije evidentiran nijedan ispis kopije.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Drawer>
        </Box>
    );
}
