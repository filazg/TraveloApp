import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, Collapse, IconButton, LinearProgress, MenuItem,
    Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { stanjeSliceData, fetchLinesThunk, fetchStanjeThunk } from "./stanjeSlice";
import ModulZaglavlje from "../modules/ModulZaglavlje";
import { useLoading } from "../loading/useLoading";

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

// Svaka kategorija dobiva jednako sirok stupac, i kad je prazna: oko usporeduje
// putnike, kaveze i bicikle po visini iste trake, pa stupci ne smiju plesati.
const SIRINA_KATEGORIJE = 152;

// Kapacitet se troši po etapi, ne po polasku: putnik koji ide od prve do zadnje
// luke zauzima mjesto na svakoj usput. Zato je mjerodavna najopterećenija etapa —
// polazak je pun čim je jedna etapa puna, bez obzira što su ostale prazne.
//
// Rezervacije postoje i za složene relacije (Split→Korčula preko Hvara); one bi
// se dvostruko brojale, pa se uzimaju samo fizičke etape (razmak reda luka = 10).
const jeFizickaEtapa = (b) =>
    Number(b.arrival_harbor_order) - Number(b.departure_harbor_order) === 10;

function stanjePolaska(sailing, luka) {
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
            doLuka: [],
            prva: sveKategorije.length
                ? { luka: sailing.arrival_harbor_name, poSifri: new Map(sveKategorije.map((k) => [k.code, k])) }
                : null,
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

    const etape = [...poEtapi.values()].sort((a, b) => a.red - b.red);

    // Putnik koji se ukrca u odabranoj luci zauzima mjesto na svakoj etapi do
    // svoje odredišne luke. Zato je za vožnju „od ove luke do one" mjerodavna
    // najpunija etapa na tom putu — ona propušta najmanje ljudi, a ostale su
    // šire. Popis se gradi kumulativno: svaka sljedeća luka nasljeđuje usko
    // grlo prethodnih etapa.
    const pocetak = etape.findIndex((e) => e.od === luka);
    const doLuka = [];
    if (pocetak !== -1) {
        const usko = new Map();
        for (let i = pocetak; i < etape.length; i++) {
            const e = etape[i];
            for (const k of e.kategorije) {
                if (k.kapacitet <= 0) continue;
                const t = usko.get(k.code);
                // Uzima se cijeli redak najuže etape, ne mješavina brojki s
                // raznih etapa — inače zauzeto i kapacitet ne bi pripadali istoj
                // vožnji i traka bi lagala.
                if (!t || k.slobodno < t.slobodno) usko.set(k.code, { ...k });
            }
            const popis = [...usko.values()].map((k) => ({ ...k }));
            doLuka.push({
                kljuc: e.kljuc,
                luka: e.do_,
                poSifri: new Map(popis.map((k) => [k.code, k])),
            });
        }
    }

    return {
        kategorije,
        // Za brzo vađenje po šifri pri crtanju stupaca.
        poSifri: new Map(kategorije.map((k) => [k.code, k])),
        doLuka,
        // Brojka koja ide u redak: stanje do prve sljedeće luke, jer se u toj
        // luci putnik i iskrcava najranije — dalje može samo biti tjesnije.
        prva: doLuka[0] || null,
    };
}

const postotak = (k) => (k && k.kapacitet ? Math.round((k.zauzeto / k.kapacitet) * 100) : 0);

const bojaPopunjenosti = (p) => {
    if (p >= 90) return "error";
    if (p >= 70) return "warning";
    return "success";
};

// Prikaz jedne kategorije: naglašen je broj slobodnih mjesta, jer se na
// blagajni pita „koliko još mogu prodati", a ne koliko ih je unutra. Zauzeto i
// kapacitet ostaju ispod, sitno, kao potvrda odakle brojka.
function Slobodno({ kategorija, veliko = true }) {
    if (!kategorija) {
        // Brod tu kategoriju nema u planu — to nije isto sto i „ima mjesta, sva
        // su prazna", pa stoji crtica, ne nula.
        return <Typography color="text.disabled">—</Typography>;
    }
    const p = postotak(kategorija);
    const boja = bojaPopunjenosti(p);
    return (
        <Box sx={{ width: "100%" }}>
            <Stack direction="row" alignItems="baseline" spacing={0.75}>
                <Typography
                    fontWeight={800}
                    fontSize={veliko ? 22 : 16}
                    lineHeight={1.15}
                    color={`${boja}.main`}
                >
                    {kategorija.slobodno}
                </Typography>
                <Typography fontSize={11} color="text.secondary">slobodno</Typography>
            </Stack>
            <LinearProgress
                variant="determinate"
                value={Math.min(100, p)}
                color={boja}
                sx={{ height: veliko ? 8 : 6, borderRadius: 4, my: 0.5 }}
            />
            <Typography fontSize={11} color="text.secondary">
                {kategorija.zauzeto} / {kategorija.kapacitet} · {p} %
            </Typography>
        </Box>
    );
}

function RedPolaska({ sailing, kategorije, luka }) {
    const [otvoren, setOtvoren] = useState(false);
    const stanje = useMemo(() => stanjePolaska(sailing, luka), [sailing, luka]);
    const otkazan = sailing.sale_status === "CANCELED" || sailing.sailing_status === "CANCELED";
    const vrijeme = sailing.first_departure_time
        || String(sailing.departure_planed || "").split(" ").slice(-1)[0]
        || "—";
    const imaRazradu = stanje.doLuka.length > 1;

    return (
        <>
            <TableRow
                hover
                onClick={() => imaRazradu && setOtvoren((v) => !v)}
                sx={{
                    opacity: otkazan ? 0.5 : 1,
                    cursor: imaRazradu ? "pointer" : "default",
                }}
            >
                {/* Strelica je vracena: bez nje nije bilo vidljivo da redak uopce
                    ima razradu po lukama. */}
                <TableCell sx={{ width: 44, pr: 0 }}>
                    {imaRazradu ? (
                        <IconButton
                            size="small"
                            onClick={(ev) => { ev.stopPropagation(); setOtvoren((v) => !v); }}
                        >
                            {otvoren ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                    ) : null}
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
                    {/* Gore stoji etapa na koju se brojke odnose, dolje cijeli
                        smjer — inace se ne zna je li „12 slobodno" do prve luke
                        ili do kraja linije. */}
                    <Typography fontWeight={700} fontSize={13}>
                        {stanje.prva ? `${luka} → ${stanje.prva.luka}` : `smjer ${sailing.direction || "—"}`}
                    </Typography>
                    <Typography color="text.secondary" fontSize={12}>
                        smjer {sailing.direction || "—"} · {sailing.departure_harbor_name} → {sailing.arrival_harbor_name}
                    </Typography>
                </TableCell>
                {kategorije.map((code) => (
                    <TableCell key={code} sx={{ width: SIRINA_KATEGORIJE }}>
                        <Slobodno kategorija={(stanje.prva || stanje).poSifri.get(code)} />
                    </TableCell>
                ))}
            </TableRow>

            <TableRow>
                <TableCell sx={{ py: 0, border: 0 }} colSpan={4 + kategorije.length}>
                    <Collapse in={otvoren} unmountOnExit>
                        <Box sx={{ py: 2, pl: 2 }}>
                            <Typography fontWeight={800} fontSize={13} sx={{ mb: 1 }}>
                                Slobodno od luke {luka} do:
                            </Typography>
                            <Paper variant="outlined" sx={{ borderRadius: 1.5 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 800 }}>Luka</TableCell>
                                            {kategorije.map((code) => (
                                                <TableCell key={code} sx={{ fontWeight: 800, width: SIRINA_KATEGORIJE }}>
                                                    {nazivKategorije(code)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {stanje.doLuka.map((d) => (
                                            <TableRow key={d.kljuc}>
                                                <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>{d.luka}</TableCell>
                                                {kategorije.map((code) => (
                                                    <TableCell key={code} sx={{ width: SIRINA_KATEGORIJE }}>
                                                        <Slobodno kategorija={d.poSifri.get(code)} veliko={false} />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

// Mobilna pločica jedne kategorije: naziv gore (na telefonu nema zaglavlja
// stupca da ga nosi), veliki broj slobodnih, traka i sitni zauzeto/kapacitet.
function KategorijaMini({ code, kategorija }) {
    const naziv = nazivKategorije(code);
    if (!kategorija) {
        return (
            <Box sx={{ p: 0.75, minWidth: 0, borderRadius: 1.5, bgcolor: "grey.100", border: "1px solid", borderColor: "divider" }}>
                <Typography fontSize={12} color="text.secondary" fontWeight={600}>{naziv}</Typography>
                <Typography color="text.disabled" fontSize={20} fontWeight={800}>—</Typography>
            </Box>
        );
    }
    const p = postotak(kategorija);
    const boja = bojaPopunjenosti(p);
    return (
        <Box sx={{ p: 0.75, minWidth: 0, borderRadius: 1.5, bgcolor: "grey.100", border: "1px solid", borderColor: "divider" }}>
            <Typography fontSize={12} color="text.secondary" fontWeight={600}>{naziv}</Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.5}>
                <Typography fontWeight={800} fontSize={20} lineHeight={1.1} color={`${boja}.main`}>
                    {kategorija.slobodno}
                </Typography>
                <Typography fontSize={10} color="text.secondary">slobodno</Typography>
            </Stack>
            <LinearProgress
                variant="determinate"
                value={Math.min(100, p)}
                color={boja}
                sx={{ height: 5, borderRadius: 3, my: 0.5 }}
            />
            <Typography fontSize={10} color="text.secondary">
                {kategorija.zauzeto} / {kategorija.kapacitet} · {p} %
            </Typography>
        </Box>
    );
}

// Mobilni prikaz polaska: isti podaci kao redak tablice, ali složeni po visini
// da stanu na usku sirinu telefona — kategorije idu u mrezu od dva stupca, a
// razrada po lukama otvara se ispod, ne u zasebnom stupcu.
function KarticaPolaska({ sailing, kategorije, luka }) {
    const [otvoren, setOtvoren] = useState(false);
    const stanje = useMemo(() => stanjePolaska(sailing, luka), [sailing, luka]);
    const otkazan = sailing.sale_status === "CANCELED" || sailing.sailing_status === "CANCELED";
    const vrijeme = sailing.first_departure_time
        || String(sailing.departure_planed || "").split(" ").slice(-1)[0]
        || "—";
    const imaRazradu = stanje.doLuka.length > 1;
    const izvor = stanje.prva || stanje;

    return (
        <Paper
            elevation={2}
            sx={{
                width: "100%",
                p: { xs: 1, sm: 1.5 },
                borderRadius: 2,
                // Naglasna traka u boji modula + sjena: kartice se jasno odvajaju
                // jedna od druge i od pozadine, umjesto tankog obruba na bijelom.
                borderLeft: "4px solid",
                borderLeftColor: ACCENT,
                opacity: otkazan ? 0.5 : 1,
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                <Typography fontWeight={800} fontSize={22} lineHeight={1}>{vrijeme}</Typography>
                <Typography fontWeight={700} fontSize={13}>{sailing.line_code}</Typography>
                {otkazan ? <Chip size="small" color="error" label="otkazan" /> : null}
            </Stack>
            <Typography color="text.secondary" fontSize={12}>{sailing.line_name}</Typography>

            {/* Gore etapa na koju se brojke odnose, dolje cijeli smjer — kao i u
                tablici, da se zna vrijedi li „slobodno" do prve luke ili do kraja. */}
            <Typography fontWeight={700} fontSize={14} sx={{ mt: 0.75 }}>
                {stanje.prva ? `${luka} → ${stanje.prva.luka}` : `smjer ${sailing.direction || "—"}`}
            </Typography>
            <Typography color="text.secondary" fontSize={11}>
                smjer {sailing.direction || "—"} · {sailing.departure_harbor_name} → {sailing.arrival_harbor_name}
            </Typography>

            <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: `repeat(${kategorije.length}, 1fr)`, gap: 1 }}>
                {kategorije.map((code) => (
                    <KategorijaMini key={code} code={code} kategorija={izvor.poSifri.get(code)} />
                ))}
            </Box>

            {imaRazradu ? (
                <>
                    <Button
                        size="small"
                        fullWidth
                        onClick={() => setOtvoren((v) => !v)}
                        endIcon={otvoren ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        sx={{ mt: 1 }}
                    >
                        {otvoren ? "Sakrij razradu po lukama" : "Slobodno po lukama"}
                    </Button>
                    <Collapse in={otvoren} unmountOnExit>
                        <Stack spacing={1.25} sx={{ mt: 1 }}>
                            {stanje.doLuka.map((d) => (
                                <Box key={d.kljuc} sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}>
                                    <Typography fontWeight={700} fontSize={13} sx={{ mb: 0.5 }}>
                                        do luke {d.luka}
                                    </Typography>
                                    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${kategorije.length}, 1fr)`, gap: 1 }}>
                                        {kategorije.map((code) => (
                                            <KategorijaMini key={code} code={code} kategorija={d.poSifri.get(code)} />
                                        ))}
                                    </Box>
                                </Box>
                            ))}
                        </Stack>
                    </Collapse>
                </>
            ) : null}
        </Paper>
    );
}

export default function StanjePage() {
    const dispatch = useDispatch();
    const s = useSelector(stanjeSliceData);
    const [datum, setDatum] = useState(danas());
    const [linija, setLinija] = useState("");
    const [luka, setLuka] = useState("");
    const { tijekom } = useLoading();

    // Ispod „md" tablica sa stupcem po kategoriji ne stane na sirinu telefona,
    // pa se prelazi na kartice — desktop i dalje dobiva tablicu.
    const theme = useTheme();
    const mobilni = useMediaQuery(theme.breakpoints.down("md"));

    useEffect(() => { dispatch(fetchLinesThunk()); }, [dispatch]);

    // Dohvat ide preko globalnog prekrivaca, kao i drugdje u portalu: dan s
    // tridesetak polazaka trazi i rezervacije za svaki, pa to zna potrajati —
    // bez poruke izgleda kao da se nista ne dogada i covjek klikne opet.
    const dohvati = useCallback(
        () => tijekom(
            "Preuzimanje stanja kapaciteta",
            () => dispatch(fetchStanjeThunk({ departure_date: datum, line_uuid: linija })),
        ),
        [dispatch, tijekom, datum, linija]
    );

    // Namjerno bez `dohvati` u popisu ovisnosti: `tijekom` nastaje iznova pri
    // svakom crtanju, pa bi ga dodavanje pretvorilo u beskonacno dohvacanje.
    useEffect(() => { if (datum) dohvati(); }, [datum, linija]);

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
        // Polazak kojem je vrijeme polaska prošlo prije više od sat vremena više
        // se ne može prodati, pa samo zatrpava popis — skrivamo ga. Vrijedi samo
        // za današnji dan: kad se bira drugi datum, prikazuju se svi polasci tog
        // dana (inače bi pregled ranijeg datuma ostao prazan). U podacima nema
        // vremena dolaska, pa je mjerodavno vrijeme polaska iz prve luke.
        const jeDanas = datum === danas();
        const granica = new Date().getTime() - 60 * 60 * 1000;
        const josAktualan = (p) => {
            if (!jeDanas) return true;
            const m = String(p.first_departure_time || "").match(/(\d{1,2}):(\d{2})/);
            if (!m) return true;
            const polazak = new Date(`${datum}T${m[1].padStart(2, "0")}:${m[2]}:00`);
            return isNaN(polazak.getTime()) || polazak.getTime() >= granica;
        };
        const kopija = (s.sailings || []).filter(
            (p) => (!luka || lukePolaska(p).has(luka)) && josAktualan(p)
        );
        // Redoslijed je vremenski, jer se zaslon čita odozgo prema dolje kroz dan.
        return kopija.sort((a, b) =>
            String(a.first_departure_time || a.departure_planed || "")
                .localeCompare(String(b.first_departure_time || b.departure_planed || "")));
    }, [s.sailings, luka, datum]);

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
        <Box sx={{ width: "100%", maxWidth: 1400, px: { xs: 0, sm: 2 }, py: { xs: 1, sm: 2 } }}>
            <ModulZaglavlje modulKey="STANJE" />

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                    {/* Datum i „Danas" idu zajedno u istom redu — i na mobitelu,
                        da gumb stoji uz polje, a ne u zasebnom retku ispod. */}
                    <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
                        <TextField
                            type="date"
                            label="Datum"
                            size="small"
                            value={datum}
                            onChange={(e) => setDatum(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: { xs: 1, sm: "none" }, minWidth: { sm: 180 } }}
                        />
                        <Button variant="outlined" onClick={() => setDatum(danas())} sx={{ flexShrink: 0 }}>Danas</Button>
                        {/* Na mobitelu osvježavanje je ikonica uz datum, da ne trosi
                            zaseban redak i visinu; puni gumb s tekstom je za sirok ekran. */}
                        <IconButton
                            onClick={dohvati}
                            disabled={s.loading}
                            aria-label="Osvježi"
                            sx={{ display: { xs: "inline-flex", sm: "none" }, ml: "auto", flexShrink: 0 }}
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Stack>
                    {/* Luka je uvjet: pitanje je uvijek „ima li mjesta iz ove luke",
                        pa popis svih polazaka u danu nikome ne koristi. Linija samo
                        dodatno suzava, kad iz iste luke vozi vise linija. */}
                    <TextField
                        select
                        required
                        label="Luka polaska"
                        size="small"
                        value={luka}
                        onChange={(e) => setLuka(e.target.value)}
                        sx={{ minWidth: { xs: "100%", sm: 220 } }}
                    >
                        <MenuItem value="">Odaberite luku</MenuItem>
                        {sveLuke.map((l) => (
                            <MenuItem key={l} value={l}>{l}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Linija (nije obavezno)"
                        size="small"
                        value={linija}
                        onChange={(e) => setLinija(e.target.value)}
                        sx={{ minWidth: { xs: "100%", sm: 300 } }}
                    >
                        <MenuItem value="">Sve linije</MenuItem>
                        {(s.lines || []).map((l) => (
                            <MenuItem key={l.uuid} value={l.uuid}>
                                {l.code} · {l.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={dohvati}
                        disabled={s.loading}
                        sx={{ display: { xs: "none", sm: "inline-flex" } }}
                    >
                        Osvježi
                    </Button>
                </Stack>
            </Paper>

            {s.error ? <Alert severity="error" sx={{ mb: 2 }}>{s.error}</Alert> : null}


            {!luka || (polasci.length === 0 && !s.loading) ? (
                <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
                    <Typography color="text.secondary" sx={{ textAlign: "center" }}>
                        {!luka ? "Odaberite luku polaska." : "Za odabrani dan nema polazaka."}
                    </Typography>
                </Paper>
            ) : mobilni ? (
                // Telefon: jedan polazak = kartica, kategorije u mrezi.
                <Stack spacing={1.5} sx={{ width: "100%" }}>
                    {polasci.map((p) => (
                        <KarticaPolaska key={p.uuid} sailing={p} kategorije={kategorije} luka={luka} />
                    ))}
                </Stack>
            ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 44 }} />
                                <TableCell sx={{ fontWeight: 800 }}>Vrijeme</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>Linija</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>Smjer</TableCell>
                                {kategorije.map((code) => (
                                    <TableCell key={code} sx={{ fontWeight: 800, width: SIRINA_KATEGORIJE }}>
                                        {nazivKategorije(code)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {polasci.map((p) => (
                                <RedPolaska key={p.uuid} sailing={p} kategorije={kategorije} luka={luka} />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
