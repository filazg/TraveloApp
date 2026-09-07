import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Badge, Box, Button, Chip, CircularProgress, Drawer, Paper, Stack, Tab, Tabs,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";

import {
    kontrolaSliceData,
    fetchCopyConflictsThunk,
    fetchConflictTypesThunk,
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

// Kratko objašnjenje uz svaku karticu — bez njega se iz naziva ne vidi što se
// točno hvata ni zašto je to sumnjivo.
const OPIS_KARTICE = {
    "": "Svi nalazi u odabranom razdoblju. Nastaju na dva mjesta: na kontroli, kad se karta očita drugi put, i pri ispisu kopije, kad se već tada vidi da nešto ne štima.",
    copy_over_original: "Original je prošao kontrolu, pa je netko pokušao i kopijom. Znači da su original i kopija istovremeno u optjecaju.",
    original_over_copy: "Kopija je prošla kontrolu, pa je netko došao s originalom. Isto što i prethodno, samo obrnutim redom.",
    copy_over_copy: "Dvije različite kopije iste karte pokušale su proći kontrolu.",
    same_artifact: "Ista karta s istom oznakom očitana je drugi put. Fotografija QR-a nosi identičnu oznaku kao original, pa je ovo jedini trag koji takav slučaj uopće ostavlja. Ovdje upada i putnik koji je dvaput prislonio kartu.",
    canceled_ticket: "Netko se pokušao ukrcati kartom koja je stornirana, često uz već vraćen novac.",
    many_copies: "Karta ima tri ili više ispisanih kopija. Prva i druga se događaju — izgubljena karta, zaglavljen papir — treća je uzorak.",
    copy_by_other_operator: "Kopiju je izdao operater koji nije prodao kartu. Kopiju u pravilu izdaje mjesto koje je i prodalo.",
};

const danaUnazad = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

export default function TicketCopyControlPage() {
    const dispatch = useDispatch();
    const data = useSelector(kontrolaSliceData);

    const [odabrana, setOdabrana] = useState(null);
    const zatvoriDetalj = () => {
        setOdabrana(null);
        dispatch(clearDetail());
    };

    const [from, setFrom] = useState(danaUnazad(30));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    // Prazna vrsta je kartica "Sve".
    const [vrsta, setVrsta] = useState("");

    const ucitaj = (zaVrstu = vrsta) => {
        dispatch(fetchCopyConflictsThunk({ from, to, ...(zaVrstu ? { type: zaVrstu } : {}) }));
    };

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        dispatch(fetchConflictTypesThunk());
        ucitaj("");
        // Prvi dohvat ide samo pri otvaranju; dalje na promjenu kartice ili na
        // zahtjev, da se popis ne osvježava pod rukom dok se čita.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const promijeniKarticu = (_e, novaVrsta) => {
        setVrsta(novaVrsta);
        // Detalj pripada karti s prethodne kartice; ostavljen otvoren bi visio
        // nad popisom koji ga više ne sadrži.
        zatvoriDetalj();
        ucitaj(novaVrsta);
    };

    // Ladici se predaje cijeli redak, ne samo uuid: podatke o karti popis je vec
    // dohvatio, pa nema razloga ici po njih drugi put.
    const otvoriDetalj = (r) => {
        setOdabrana(r);
        dispatch(setDetailTicket(r.ticket_uuid));
        dispatch(fetchTicketValidationsThunk({ ticket_uuid: r.ticket_uuid }));
        dispatch(fetchCopyPrintsThunk({ ticket_uuid: r.ticket_uuid }));
    };
    const sukobi = data.conflicts || [];
    const brojaci = data.counts || {};
    const ukupno = Object.values(brojaci).reduce((z, n) => z + n, 0);

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

            {/* Kartica po vrsti sukoba, a prva sadrži sve. Brojači se računaju
                nad punim popisom, pa ostaju točni i dok je odabrana jedna vrsta. */}
            <Tabs
                value={vrsta}
                onChange={promijeniKarticu}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
            >
                <Tab
                    value=""
                    label={
                        <Badge badgeContent={ukupno} color="error" sx={{ pr: ukupno ? 2 : 0 }}>
                            Sve
                        </Badge>
                    }
                />
                {(data.types || []).map((t) => (
                    <Tab
                        key={t.value}
                        value={t.value}
                        label={
                            <Badge
                                badgeContent={brojaci[t.value] || 0}
                                color="error"
                                sx={{ pr: brojaci[t.value] ? 2 : 0 }}
                            >
                                {t.label}
                            </Badge>
                        }
                    />
                ))}
            </Tabs>

            <Alert severity="info" sx={{ mb: 2 }}>
                {OPIS_KARTICE[vrsta] || OPIS_KARTICE[""]}
            </Alert>

            {data.conflictsError && (
                <Alert severity="error" sx={{ mb: 2 }}>{data.conflictsError}</Alert>
            )}

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Broj karte</TableCell>
                            {/* Vrsta se pokazuje samo na kartici "Sve" — na ostalima
                                je ista u svakom retku i samo troši prostor. */}
                            {!vrsta && <TableCell>Vrsta</TableCell>}
                            <TableCell>Relacija</TableCell>
                            {/* Kada je original izdan — iz toga se vidi je li kopija
                                nastala odmah po prodaji ili danima kasnije. */}
                            <TableCell>Original izdan</TableCell>
                            <TableCell>Original izdao</TableCell>
                            <TableCell align="right">Slučajeva</TableCell>
                            <TableCell>Zadnji put</TableCell>
                            <TableCell>Razlog</TableCell>
                            <TableCell>Kontrolor</TableCell>
                            <TableCell>Uređaj</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.conflictsLoading && (
                            <TableRow>
                                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                                    <CircularProgress size={22} />
                                </TableCell>
                            </TableRow>
                        )}
                        {!data.conflictsLoading && sukobi.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}>
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
                                {!vrsta && (
                                    <TableCell>
                                        <Chip size="small" variant="outlined" label={r.type_label || r.type} />
                                    </TableCell>
                                )}
                                <TableCell>
                                    {r.departure_harbor_name
                                        ? `${r.departure_harbor_name} → ${r.arrival_harbor_name || ""}`
                                        : "—"}
                                </TableCell>
                                <TableCell>{fmtVrijeme(r.ticket_issued_at)}</TableCell>
                                <TableCell>
                                    {r.issued_by || "—"}
                                    {r.issued_at_premise ? ` · ${r.issued_at_premise}` : ""}
                                </TableCell>
                                <TableCell align="right">
                                    <Chip size="small" color="error" label={r.event_count} />
                                </TableCell>
                                <TableCell>{fmtVrijeme(r.last_at)}</TableCell>
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
                                ["Original izdao", odabrana.issued_by
                                    ? `${odabrana.issued_by}${odabrana.issued_at_premise ? " · " + odabrana.issued_at_premise : ""}`
                                    : "—"],
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
