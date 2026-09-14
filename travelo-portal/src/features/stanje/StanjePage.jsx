import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, Collapse, IconButton, LinearProgress, MenuItem,
    Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import RefreshIcon from "@mui/icons-material/Refresh";

import { stanjeSliceData, fetchLinesThunk, fetchStanjeThunk } from "./stanjeSlice";
import ModulZaglavlje from "../modules/ModulZaglavlje";

// Boja modula — ista koja stoji u katalogu za STANJE.
const ACCENT = "#0E7C66";

const NAZIV_KATEGORIJE = {
    PASSANGER: "Putnici",
    VIP: "VIP",
    BICYCLE: "Bicikli",
    // Na blagajni i na mobilnoj ista kategorija pise "Kavezi"; neka bude isto i ovdje.
    PETS: "Kavezi",
};
const nazivKategorije = (code) => NAZIV_KATEGORIJE[code] || code;

// Redoslijed stupaca je stalan, da se oko ne mora tražiti po tablici: putnici
// prvi jer se po njima gleda je li brod pun, ostalo iza njih.
const REDOSLIJED = ["PASSANGER", "PETS", "BICYCLE", "VIP"];
// Tri kategorije se pokazuju uvijek, i kad su na nuli — to je trojka po kojoj se
// brod gleda i na blagajni. VIP se pridruzi samo ako ga neki brod tog dana ima.
const STALNE = ["PASSANGER", "PETS", "BICYCLE"];
const poRedoslijedu = (a, b) => {
    const ia = REDOSLIJED.indexOf(a);
    const ib = REDOSLIJED.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || String(a).localeCompare(String(b));
};

const danas = () => new Date().toISOString().slice(0, 10);

// Kapacitet se troši po etapi, ne po polasku: putnik koji ide od prve do zadnje
// luke zauzima mjesto na svakoj usput. Zato je mjerodavna najopterećenija etapa —
// polazak je pun čim je jedna etapa puna, bez obzira što su ostale prazne.
//
// Rezervacije postoje i za složene relacije (Split→Korčula preko Hvara); one bi
// se dvostruko brojale, pa se uzimaju samo fizičke etape (razmak reda luka = 10).
const jeFizickaEtapa = (b) =>
    Number(b.arrival_harbor_order) - Number(b.departure_harbor_order) === 10;

function stanjePolaska(sailing) {
    const redci = (sailing.bookings || []).filter(jeFizickaEtapa);

    // Polazak bez ijedne rezervacije još nije ni otvoren za prodaju — kapacitet
    // se tada čita s plovidbenog reda, a zauzeto je nula.
    if (!redci.length) {
        const kap = Number(sailing.base_capacity) || 0;
        const sveKategorije = [];
        if (kap) sveKategorije.push({ code: "PASSANGER", kapacitet: kap, zauzeto: 0, slobodno: kap });
        // Plovidbeni red nosi i ostale kapacitete broda, pa se i oni vide dok
        // prodaje još nema — inače bi stupci bili prazni bez razloga.
        const dodatni = [
            ["VIP", sailing.base_vip_capacity],
            ["BICYCLE", sailing.base_bicycle_capacity],
            ["PETS", sailing.base_pets_capacity],
        ];
        for (const [code, v] of dodatni) {
            const n = Number(v) || 0;
            if (n > 0) sveKategorije.push({ code, kapacitet: n, zauzeto: 0, slobodno: n });
        }
        return {
            kategorije: sveKategorije,
            poSifri: new Map(sveKategorije.map((k) => [k.code, k])),
            etape: [],
            glavna: sveKategorije[0] || null,
        };
    }

    const poKategoriji = new Map();
    const poEtapi = new Map();

    for (const b of redci) {
        const kap = (Number(b.capacity_base) || 0) + (Number(b.capacity_additional) || 0);
        const zauzeto = Number(b.occupied) || 0;

        const k = poKategoriji.get(b.category_code) || { code: b.category_code, kapacitet: 0, zauzeto: 0 };
        k.kapacitet = Math.max(k.kapacitet, kap);
        k.zauzeto = Math.max(k.zauzeto, zauzeto);
        poKategoriji.set(b.category_code, k);

        const kljucEtape = `${b.departure_harbor_order}|${b.arrival_harbor_order}`;
        const e = poEtapi.get(kljucEtape) || {
            kljuc: kljucEtape,
            red: Number(b.departure_harbor_order),
            od: b.departure_harbor_name,
            do_: b.arrival_harbor_name,
            kategorije: [],
        };
        e.kategorije.push({ code: b.category_code, kapacitet: kap, zauzeto, slobodno: Math.max(0, kap - zauzeto) });
        poEtapi.set(kljucEtape, e);
    }

    const kategorije = [...poKategoriji.values()]
        .map((k) => ({ ...k, slobodno: Math.max(0, k.kapacitet - k.zauzeto) }))
        .filter((k) => k.kapacitet > 0)
        .sort((a, b) => b.kapacitet - a.kapacitet);

    return {
        kategorije,
        // Za brzo vađenje po šifri pri crtanju stupaca.
        poSifri: new Map(kategorije.map((k) => [k.code, k])),
        etape: [...poEtapi.values()].sort((a, b) => a.red - b.red),
        // Glavna brojka je kategorija s najvećim kapacitetom — na brodu su to putnici.
        glavna: kategorije[0] || null,
    };
}

const postotak = (k) => (k && k.kapacitet ? Math.round((k.zauzeto / k.kapacitet) * 100) : 0);

const bojaPopunjenosti = (p) => {
    if (p >= 90) return "error";
    if (p >= 70) return "warning";
    return "success";
};

function Popunjenost({ kategorija }) {
    if (!kategorija) return <Typography color="text.secondary">—</Typography>;
    const p = postotak(kategorija);
    return (
        // Uze nego prije, jer sada svaka kategorija ima svoj stupac.
        <Box sx={{ minWidth: 130 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography fontWeight={700} fontSize={13}>
                    {kategorija.zauzeto} / {kategorija.kapacitet}
                </Typography>
                <Typography fontSize={13} color="text.secondary">{p} %</Typography>
            </Stack>
            <LinearProgress
                variant="determinate"
                value={Math.min(100, p)}
                color={bojaPopunjenosti(p)}
                sx={{ height: 8, borderRadius: 4 }}
            />
        </Box>
    );
}

function RedPolaska({ sailing, kategorije }) {
    const [otvoren, setOtvoren] = useState(false);
    const stanje = useMemo(() => stanjePolaska(sailing), [sailing]);
    const otkazan = sailing.sale_status === "CANCELED" || sailing.sailing_status === "CANCELED";
    const vrijeme = sailing.first_departure_time
        || String(sailing.departure_planed || "").split(" ").slice(-1)[0]
        || "—";

    return (
        <>
            <TableRow hover sx={{ opacity: otkazan ? 0.5 : 1 }}>
                <TableCell sx={{ width: 48 }}>
                    <IconButton size="small" onClick={() => setOtvoren((v) => !v)} disabled={!stanje.etape.length}>
                        {otvoren ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 15 }}>
                    {vrijeme}
                    {/* Stupca statusa vise nema, ali otkazan polazak ne smije
                        izgledati kao svaki drugi — inace se rasporeduju putnici
                        na brod koji ne vozi. */}
                    {otkazan ? (
                        <Chip size="small" color="error" label="otkazan" sx={{ ml: 1 }} />
                    ) : null}
                </TableCell>
                <TableCell>
                    <Typography fontWeight={700} fontSize={13}>{sailing.line_code}</Typography>
                    <Typography color="text.secondary" fontSize={12}>{sailing.line_name}</Typography>
                </TableCell>
                <TableCell>
                    <Typography fontWeight={700} fontSize={13}>
                        smjer {sailing.direction || "—"}
                    </Typography>
                    <Typography color="text.secondary" fontSize={12}>
                        {sailing.departure_harbor_name} → {sailing.arrival_harbor_name}
                    </Typography>
                </TableCell>
                {kategorije.map((code) => {
                    const k = stanje.poSifri.get(code);
                    return (
                        <TableCell key={code}>
                            {k ? (
                                <Stack spacing={0.25}>
                                    <Popunjenost kategorija={k} />
                                    <Typography fontSize={11} color="text.secondary">
                                        slobodno {k.slobodno}
                                    </Typography>
                                </Stack>
                            ) : (
                                // Brod tu kategoriju nema u planu — to nije isto sto i
                                // „ima mjesta, sva su prazna", pa stoji crtica, ne nula.
                                <Typography color="text.disabled">—</Typography>
                            )}
                        </TableCell>
                    );
                })}
            </TableRow>

            <TableRow>
                <TableCell sx={{ py: 0, border: 0 }} colSpan={4 + kategorije.length}>
                    <Collapse in={otvoren} unmountOnExit>
                        <Box sx={{ py: 2, pl: 6 }}>
                            <Typography fontWeight={800} fontSize={13} sx={{ mb: 1 }}>
                                Po etapama
                            </Typography>
                            <Stack spacing={1}>
                                {stanje.etape.map((e) => (
                                    <Paper key={e.kljuc} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
                                        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
                                            <Typography sx={{ minWidth: 220, fontWeight: 700, fontSize: 13 }}>
                                                {e.od} → {e.do_}
                                            </Typography>
                                            {e.kategorije
                                                .filter((k) => k.kapacitet > 0)
                                                .sort((a, b) => b.kapacitet - a.kapacitet)
                                                .map((k) => (
                                                    <Stack key={k.code} direction="row" spacing={1} alignItems="center">
                                                        <Typography fontSize={12} color="text.secondary" sx={{ minWidth: 70 }}>
                                                            {nazivKategorije(k.code)}
                                                        </Typography>
                                                        <Box sx={{ width: 140 }}><Popunjenost kategorija={k} /></Box>
                                                        <Typography fontSize={12} color="text.secondary">
                                                            slobodno {k.slobodno}
                                                        </Typography>
                                                    </Stack>
                                                ))}
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

export default function StanjePage() {
    const dispatch = useDispatch();
    const s = useSelector(stanjeSliceData);
    const [datum, setDatum] = useState(danas());
    const [linija, setLinija] = useState("");
    const [luka, setLuka] = useState("");

    useEffect(() => { dispatch(fetchLinesThunk()); }, [dispatch]);
    useEffect(() => {
        if (datum) dispatch(fetchStanjeThunk({ departure_date: datum, line_uuid: linija }));
    }, [dispatch, datum, linija]);

    // Luka polaska: uz pocetnu luku plovidbe racunaju se i sve usputne iz kojih
    // brod krece dalje. Djelatnik u Hvaru trazi brod koji iz Hvara vozi, bez
    // obzira sto je krenuo iz Splita.
    const lukePolaska = (p) => {
        const set = new Set();
        if (p.departure_harbor_name) set.add(p.departure_harbor_name);
        for (const b of (p.bookings || [])) {
            if (jeFizickaEtapa(b) && b.departure_harbor_name) set.add(b.departure_harbor_name);
        }
        return set;
    };

    const sveLuke = useMemo(() => {
        const set = new Set();
        for (const p of (s.sailings || [])) for (const l of lukePolaska(p)) set.add(l);
        return [...set].sort((a, b) => a.localeCompare(b, "hr"));
    }, [s.sailings]);

    const polasci = useMemo(() => {
        const kopija = (s.sailings || []).filter((p) => !luka || lukePolaska(p).has(luka));
        // Redoslijed je vremenski, jer se zaslon čita odozgo prema dolje kroz dan.
        return kopija.sort((a, b) =>
            String(a.first_departure_time || a.departure_planed || "")
                .localeCompare(String(b.first_departure_time || b.departure_planed || "")));
    }, [s.sailings, luka]);

    // Stupci se slazu iz onoga sto brodovi tog dana stvarno imaju: linija bez
    // bicikala nema zasto nositi prazan stupac kroz cijelu tablicu.
    const kategorije = useMemo(() => {
        const set = new Set(STALNE);
        for (const p of polasci) {
            for (const k of stanjePolaska(p).kategorije) set.add(k.code);
        }
        return [...set].sort(poRedoslijedu);
    }, [polasci]);

    return (
        // Ista sirina kao kapetanski modul, s kojim dijeli i podatke — zasloni
        // koji se gledaju jedan za drugim ne bi smjeli skakati u sirini.
        <Box sx={{ width: "100%", maxWidth: 1400, p: 2 }}>
            <ModulZaglavlje modulKey="STANJE" />

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                    <TextField
                        type="date"
                        label="Datum"
                        size="small"
                        value={datum}
                        onChange={(e) => setDatum(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 180 }}
                    />
                    <Button variant="outlined" onClick={() => setDatum(danas())}>Danas</Button>
                    <TextField
                        select
                        label="Linija"
                        size="small"
                        value={linija}
                        onChange={(e) => setLinija(e.target.value)}
                        sx={{ minWidth: 320 }}
                    >
                        <MenuItem value="">Sve linije</MenuItem>
                        {(s.lines || []).map((l) => (
                            <MenuItem key={l.uuid} value={l.uuid}>
                                {l.code} · {l.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Luka polaska"
                        size="small"
                        value={luka}
                        onChange={(e) => setLuka(e.target.value)}
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="">Sve luke</MenuItem>
                        {sveLuke.map((l) => (
                            <MenuItem key={l} value={l}>{l}</MenuItem>
                        ))}
                    </TextField>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={() => dispatch(fetchStanjeThunk({ departure_date: datum, line_uuid: linija }))}
                        disabled={s.loading}
                    >
                        Osvježi
                    </Button>
                </Stack>
            </Paper>

            {s.error ? <Alert severity="error" sx={{ mb: 2 }}>{s.error}</Alert> : null}


            {s.loading ? <LinearProgress sx={{ mb: 1 }} /> : null}

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell />
                            <TableCell sx={{ fontWeight: 800 }}>Vrijeme</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Linija</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Smjer</TableCell>
                            {kategorije.map((code) => (
                                <TableCell key={code} sx={{ fontWeight: 800 }}>
                                    {nazivKategorije(code)}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {polasci.length === 0 && !s.loading ? (
                            <TableRow>
                                <TableCell colSpan={4 + kategorije.length}>
                                    <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                                        Za odabrani dan nema polazaka.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : polasci.map((p) => (
                            <RedPolaska key={p.uuid} sailing={p} kategorije={kategorije} />
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
