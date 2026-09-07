import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, Divider, Drawer, Paper, Stack, Tab, Tabs,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
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
// Kartica "Sve" nema svoju napomenu: popis je mjesavina i tekst bi opisivao
// sve i nista. Objasnjenje ide uz kartice koje hvataju jednu stvar.
const OPIS_KARTICE = {
    copy_conflict: "Original i kopija iste karte istovremeno su u optjecaju: jedan otisak je prošao kontrolu, a onda je došao drugi. Razlog uz redak kaže je li kopija došla preko originala, original preko kopije ili druga kopija preko prve.",
    same_artifact: "Ista karta s istom oznakom očitana je više puta. Fotografija QR-a nosi identičnu oznaku kao original, pa je ovo jedini trag koji takav slučaj uopće ostavlja. Ovdje upada i putnik koji je dvaput prislonio kartu.",
    canceled_ticket: "Netko se pokušao ukrcati kartom koja je stornirana, često uz već vraćen novac.",
    many_copies: "Karta ima tri ili više ispisanih kopija. Prva i druga se događaju — izgubljena karta, zaglavljen papir — treća je uzorak.",
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
    const [sifra, setSifra] = useState("");
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

    // Ladici se predaje cijeli redak, ne samo uuid: podatke o karti popis je već
    // dohvatio, pa nema razloga ići po njih drugi put.
    const otvoriDetalj = (r) => {
        setOdabrana(r);
        dispatch(setDetailTicket(r.ticket_uuid));
        dispatch(fetchTicketValidationsThunk({ ticket_uuid: r.ticket_uuid }));
        dispatch(fetchCopyPrintsThunk({ ticket_uuid: r.ticket_uuid }));
    };

    // Šifra karte se filtrira ovdje, ne na poslužitelju: popis je već u
    // memoriji i ograničen razdobljem, pa je odlazak po isti podatak čist trošak.
    const sviRedci = data.conflicts || [];
    const sukobi = sifra
        ? sviRedci.filter((r) => String(r.ticket_code || "").toUpperCase().includes(sifra))
        : sviRedci;
    const brojaci = data.counts || {};
    const ukupno = Object.values(brojaci).reduce((z, n) => z + n, 0);

    // Tablica puni preostalu visinu prozora, kao i u pregledu karata — inače na
    // kraćem popisu ostane prazan pojas, a na duljem se skrola cijela stranica.
    const tablicaRef = useRef(null);
    const [visinaTablice, setVisinaTablice] = useState(520);
    useLayoutEffect(() => {
        const preracunaj = () => {
            const vrh = tablicaRef.current?.getBoundingClientRect().top ?? 0;
            setVisinaTablice(Math.max(320, window.innerHeight - vrh - 24));
        };
        preracunaj();
        window.addEventListener("resize", preracunaj);
        return () => window.removeEventListener("resize", preracunaj);
    }, [vrsta, sukobi.length]);

    const columns = [
        { field: "ticket_code", headerName: "Broj karte", width: 150 },
        ...(vrsta ? [] : [{
            field: "type_label",
            headerName: "Vrsta",
            width: 170,
            renderCell: (p) => <Chip size="small" variant="outlined" label={p.value || ""} />,
        }]),
        {
            field: "relacija",
            headerName: "Relacija",
            width: 190,
            valueGetter: (_v, r) => (r.departure_harbor_name
                ? `${r.departure_harbor_name} → ${r.arrival_harbor_name || ""}`
                : "—"),
        },
        { field: "line_code", headerName: "Linija", width: 90 },
        { field: "departure", headerName: "Polazak", width: 160 },
        {
            field: "ticket_issued_at",
            headerName: "Original izdan",
            width: 170,
            valueFormatter: (v) => fmtVrijeme(v),
        },
        {
            field: "issued_by",
            headerName: "Original izdao",
            width: 200,
            valueGetter: (_v, r) => (r.issued_by
                ? `${r.issued_by}${r.issued_at_premise ? " · " + r.issued_at_premise : ""}`
                : "—"),
        },
        // Vrijeme storna ima smisla samo tamo gdje karta jest stornirana; na
        // ostalim karticama bi stupac bio prazan u svakom retku.
        ...(vrsta === "canceled_ticket" ? [{
            field: "canceled_at",
            headerName: "Stornirana",
            width: 170,
            valueFormatter: (v) => fmtVrijeme(v),
        }] : []),
        {
            field: "event_count",
            // Na kartici previse kopija broj znaci koliko je kopija ispisano, a
            // na ostalima koliko je puta sukob zabiljezen. Ista brojka, dva
            // razlicita pitanja — pa i naziv prati karticu.
            headerName: vrsta === "many_copies" ? "Kopija" : "Slučajeva",
            width: 100,
            align: "right",
            headerAlign: "right",
            renderCell: (p) => <Chip size="small" color="error" label={p.value} />,
        },
        {
            field: "last_at",
            headerName: "Zadnji put",
            width: 170,
            valueFormatter: (v) => fmtVrijeme(v),
        },
        { field: "last_reason", headerName: "Razlog", width: 300 },
        { field: "last_operator", headerName: "Validirao", width: 160 },
        { field: "last_terminal", headerName: "Uređaj", width: 140 },
    ];

    return (
        <Box sx={{ width: "100%", maxWidth: 1600 }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" fontWeight={800} sx={{ mr: 2 }}>
                        Kontrola kopija karata
                    </Typography>
                    <TextField
                        size="small" type="date" label="Od" InputLabelProps={{ shrink: true }}
                        value={from} onChange={(e) => setFrom(e.target.value)}
                    />
                    <TextField
                        size="small" type="date" label="Do" InputLabelProps={{ shrink: true }}
                        value={to} onChange={(e) => setTo(e.target.value)}
                    />
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                        size="small"
                        label="Šifra karte"
                        value={sifra}
                        onChange={(e) => setSifra(e.target.value.toUpperCase())}
                        sx={{ width: 200 }}
                        helperText="filtrira prikazani popis"
                    />
                    <Box sx={{ flex: 1 }} />
                    <Chip label={`${sukobi.length} nalaza`} />
                    <Button onClick={() => setSifra("")} disabled={!sifra}>Očisti</Button>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={() => ucitaj()}
                        disabled={data.conflictsLoading}
                    >
                        Pretraži
                    </Button>
                </Stack>
            </Paper>

            {data.conflictsError && <Alert severity="error" sx={{ mb: 2 }}>{data.conflictsError}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}>
                <Tabs value={vrsta} onChange={promijeniKarticu} variant="scrollable" scrollButtons="auto">
                    <Tab value="" label={`Sve (${ukupno})`} />
                    {(data.types || []).map((t) => (
                        <Tab key={t.value} value={t.value} label={`${t.label} (${brojaci[t.value] || 0})`} />
                    ))}
                </Tabs>
            </Box>

            {OPIS_KARTICE[vrsta] && (
                <Alert severity="info" sx={{ mb: 1 }}>{OPIS_KARTICE[vrsta]}</Alert>
            )}

            <Box ref={tablicaRef} sx={{ height: visinaTablice, minWidth: 1200 }}>
                <DataGrid
                    rows={sukobi}
                    getRowId={(r) => `${r.ticket_uuid}|${r.type}`}
                    columns={columns}
                    loading={data.conflictsLoading}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 50, page: 0 } },
                        sorting: { sortModel: [{ field: "last_at", sort: "desc" }] },
                    }}
                    pageSizeOptions={[25, 50, 100, 250]}
                    disableRowSelectionOnClick
                    onRowClick={(p) => otvoriDetalj(p.row)}
                    sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
                />
            </Box>

            {/* Detalj: cijela povijest karte. Sukob se ne da procijeniti iz jednog
                retka — treba se vidjeti što je prošlo prvo i koje su kopije uopće
                izdane. */}
            <Drawer
                anchor="right"
                open={!!data.detailTicketUuid}
                onClose={zatvoriDetalj}
                PaperProps={{ sx: { width: { xs: "100%", md: 760 }, p: 3 } }}
            >
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Typography variant="h6" fontWeight={800}>Povijest karte</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Button startIcon={<CloseIcon />} onClick={zatvoriDetalj}>Zatvori</Button>
                </Stack>

                {/* Podaci o originalu. Bez njih se povijest čita bez uporišta —
                    ne vidi se koja je to karta ni koliko je vremena prošlo od
                    prodaje do prve kopije. */}
                {odabrana && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap", rowGap: 1.5 }}>
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
                                // Samo za storniranu kartu — inače prazan podatak
                                // koji zbunjuje.
                                ...(odabrana.ticket_canceled
                                    ? [["Stornirana", fmtVrijeme(odabrana.canceled_at)]]
                                    : []),
                            ].map(([oznaka, vrijednost]) => (
                                <Box key={oznaka}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        {oznaka}
                                    </Typography>
                                    <Typography fontWeight={700} fontSize={14}>{vrijednost}</Typography>
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
                                <TableCell>Validirao</TableCell>
                                <TableCell>Napomena</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(data.validations || []).map((v) => {
                                const i = ISHOD[v.outcome] || { label: v.outcome, color: "default" };
                                return (
                                    <TableRow key={v.id} sx={v.is_conflict ? { bgcolor: "rgba(179,38,30,0.06)" } : {}}>
                                        <TableCell>{fmtVrijeme(v.validated_at)}</TableCell>
                                        <TableCell><Chip size="small" color={i.color} label={i.label} /></TableCell>
                                        <TableCell>
                                            {opisOtiska(v)}{v.suffix ? ` · ${v.suffix}` : ""}
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
