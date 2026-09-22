import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle,
    Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { allAppData } from "../../store/appSlice";
import { popustBezMreze } from "./subsidisedHelpers";

// Povratna OTOČNA karta u zasebnom modalu (Način 1 iz "Povlaštene karte", a
// kasnije i Način 2 iz košarice). Bira se datum povratka + polazak u obrnutom
// smjeru (bilo koja linija koja voze tu relaciju tog dana), radi se SVJEŽA
// provjera prava kartice za odabranu rutu, prikaže otočna cijena te rute (uz
// popust-logiku roditelja) i doda povratna otočna karta.
//
// Logika koja mora biti jedinstvena (provjera, cijena, blok povlastice,
// dodavanje) dolazi kroz propove iz roditelja — da se ne duplicira money-kod.
const uEnGb = (d) => { try { return dayjs(d).format("DD/MM/YYYY"); } catch { return ""; } };
const vrijemeRute = (r) => {
    const m = String(r?.actual_departure || r?.departure || "").match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : "";
};

export default function IslandReturnModal({
    open,
    onClose,
    polaznaData,       // opis polazne karte (isti oblik kao IZNOS gumb) — doda se uz povratnu
    relacija,          // polazna: { departure_harbor_id, arrival_harbor_id, ... }
    kartica,           // { vrsta, vrijednost, sustav, F2 }
    pocetniDatum,      // JS Date — zadani datum povratka
    provjeriRutu,      // async ({vrsta,vrijednost,sustav,kartica,route,date}) => ishod
    cijenaPovlastene,  // (ishod, cijenaRed) => number
    blokPovlastice,    // ({ishod, cijenaRed}) => obj
    onDodaj,           // (data) => void  (handleAddTickets)
}) {
    const appData = useSelector(allAppData);
    const [dan, setDan] = useState(pocetniDatum || new Date());
    const [rutaUuid, setRutaUuid] = useState("");
    const [provjera, setProvjera] = useState(null);
    const [radi, setRadi] = useState(false);
    const [kalendarOtvoren, setKalendarOtvoren] = useState(false);

    // Modal se ne unmounta — bez ovoga bi pri ponovnom otvaranju iskočio stari
    // rezultat provjere (npr. "POVRATNA BESPLATNA") dok se ne promijeni polazak.
    // Svako otvaranje kreće čisto: zadani datum, bez odabranog polaska/provjere.
    useEffect(() => {
        if (open) {
            setDan(pocetniDatum || new Date());
            setRutaUuid("");
            setProvjera(null);
            setRadi(false);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const from = relacija?.arrival_harbor_id;  // povratak kreće iz luke dolaska
    const to = relacija?.departure_harbor_id;

    // Polasci u obrnutom smjeru za odabrani dan — bilo koja linija.
    const povratneRute = useMemo(() => {
        if (!from || !to) return [];
        const trazeni = uEnGb(dan);
        return (appData.transportData?.routes || [])
            .filter((r) => r.departure_date === trazeni
                && r.departure_harbor_id === from
                && r.arrival_harbor_id === to)
            .sort((a, b) => vrijemeRute(a).localeCompare(vrijemeRute(b)));
    }, [appData.transportData, from, to, dan]);

    const ruta = povratneRute.find((r) => r.uuid === rutaUuid) || null;

    // Otočna cijena povratne rute (timetable + par luka, oba smjera).
    const cijenaRed = useMemo(() => {
        if (!ruta) return null;
        const sve = appData.transportData?.route_prices || [];
        return sve.find((p) => p.timetable_uuid === ruta.timetable_uuid
            && p.is_island === true
            && p.is_active !== false
            && ((p.harbor_from_code === ruta.departure_harbor_id && p.harbor_to_code === ruta.arrival_harbor_id)
                || (p.harbor_to_code === ruta.departure_harbor_id && p.harbor_from_code === ruta.arrival_harbor_id))) || null;
    }, [ruta, appData.transportData]);

    const provjeri = async () => {
        if (!ruta) return;
        setRadi(true);
        setProvjera(null);
        try {
            const ishod = await provjeriRutu({
                vrsta: kartica?.vrsta || "card_no",
                vrijednost: kartica?.vrijednost,
                sustav: kartica?.sustav || "SEOP",
                kartica: kartica?.F2 || null,
                route: {
                    line_no: ruta.line_code,
                    departure_harbor_code: ruta.departure_harbor_id,
                    arrival_harbor_code: ruta.arrival_harbor_id,
                },
                date: ruta.actual_departure || ruta.departure,
            });
            setProvjera(ishod);
        } finally {
            setRadi(false);
        }
    };

    // Bez veze sa SEOP-om odluka se donosi lokalno, istim pravilima kao za
    // polaznu — inace bi povratna bila nemoguca cim SEOP ne odgovara, a putnik
    // koji se vraca isti dan ostao bez pola putovanja.
    //
    // Provjera ide po odabranoj povratnoj ruti: druga ruta moze biti druga
    // linija, s drugim postavkama i drugim otocima.
    const bezVeze = provjera?.offline === true;
    const odlukaBezMreze = useMemo(() => {
        if (!bezVeze || !ruta) return null;
        const linija = (appData.transportData?.lines || [])
            .find((l) => String(l.code) === String(ruta.line_code || ""));
        const kodovi = [ruta.departure_harbor_id, ruta.arrival_harbor_id]
            .map((c) => String(c || "").trim())
            .filter(Boolean);
        return popustBezMreze({
            popusti: appData.basicData?.seop_right_discounts || [],
            pravo: kartica?.F2?.BasicRight || null,
            otokKartice: kartica?.F2?.IslandName || null,
            linija: linija || null,
            luke: (appData.transportData?.harbors || [])
                .filter((l) => kodovi.includes(String(l?.code || "").trim())),
        });
    }, [bezVeze, ruta, appData.transportData, appData.basicData, kartica]);

    const smije = bezVeze
        ? odlukaBezMreze?.pravo_vrijedi === true
        : provjera?.smije_se_prodati === true;
    // Cijena po istom pravilu kao za polaznu: postotak iz sifarnika ako ga
    // linija primjenjuje, inace otocna cijena iz cjenika.
    const iznos = !cijenaRed || !provjera
        ? 0
        : bezVeze
            ? (smije
                ? (odlukaBezMreze?.primjeni_popust
                    ? +(Number(cijenaRed.price) * (1 - Number(odlukaBezMreze.popust_postotak) / 100)).toFixed(2)
                    : +Number(cijenaRed.price).toFixed(2))
                : 0)
            : cijenaPovlastene(provjera, cijenaRed);

    const dodaj = () => {
        if (!ruta || !cijenaRed || !smije) return;
        const povratnaData = {
            price: cijenaRed,
            rights: {},
            type: kartica?.sustav || "SEOP",
            free: iznos === 0,
            iznos,
            povlastica: blokPovlastice({ ishod: provjera, cijenaRed, bezMreze: bezVeze ? odlukaBezMreze : null }),
            route: ruta,
        };
        // Povratno putovanje = oba smjera. Ako je polazna proslijedjena, dodaju se
        // obje karte JEDNIM pozivom (niz) — inace se dodaje samo povratna.
        onDodaj(polaznaData ? [polaznaData, povratnaData] : povratnaData);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                Povratna otočna karta
                <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {relacija ? `${relacija.arrival_harbor_name || from} → ${relacija.departure_harbor_name || to}` : ""}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {polaznaData ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {`Uz povratnu se dodaje i polazna: ${relacija ? `${relacija.departure_harbor_name || ""} → ${relacija.arrival_harbor_name || ""}` : ""}`}
                        {` — ${polaznaData.free ? "besplatno" : `${Number(polaznaData.iznos || 0).toFixed(2)} EUR`}`}
                    </Alert>
                ) : null}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="hr">
                        <DatePicker
                            label="Datum povratka"
                            format="DD.MM.YYYY"
                            disablePast
                            sx={{ flex: 1 }}
                            value={dayjs(dan)}
                            open={kalendarOtvoren}
                            onOpen={() => setKalendarOtvoren(true)}
                            onClose={() => setKalendarOtvoren(false)}
                            slotProps={{
                                textField: {
                                    // Klik na cijelo polje otvara kalendar (kao na osnovnom ekranu);
                                    // readOnly da se ne diže tipkovnica na dodirnom zaslonu.
                                    onClick: () => setKalendarOtvoren(true),
                                    inputProps: { readOnly: true },
                                    sx: { flex: 1, minWidth: 0, "& .MuiInputBase-root": { cursor: "pointer" } },
                                },
                            }}
                            onChange={(v) => { if (v?.$d) { setDan(v.$d); setRutaUuid(""); setProvjera(null); } }}
                        />
                    </LocalizationProvider>
                    <FormControl sx={{ flex: 1 }} disabled={!povratneRute.length}>
                        <InputLabel id="povratni-polazak">Polazak</InputLabel>
                        <Select
                            labelId="povratni-polazak"
                            label="Polazak"
                            value={rutaUuid}
                            onChange={(e) => { setRutaUuid(e.target.value); setProvjera(null); }}
                        >
                            {povratneRute.map((r) => (
                                <MenuItem key={r.uuid} value={r.uuid}>
                                    {`${vrijemeRute(r)} · linija ${r.line_code || ""}`}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>

                {!povratneRute.length ? (
                    <Alert severity="info" sx={{ mb: 1 }}>Za taj dan nema povratka na ovoj relaciji. Odaberite drugi datum.</Alert>
                ) : null}

                <Button
                    variant="outlined"
                    fullWidth
                    disabled={!rutaUuid || radi}
                    onClick={provjeri}
                    startIcon={radi ? <CircularProgress size={16} /> : null}
                    sx={{ mb: 1.5 }}
                >
                    {radi ? "PROVJERA…" : "PROVJERI PRAVO ZA POVRATNU"}
                </Button>

                {provjera ? (
                    <>
                        <Divider sx={{ mb: 1.5 }} />
                        <Typography
                            align="center"
                            sx={{ fontWeight: 800, py: 0.5 }}
                            color={smije ? "success.main" : (bezVeze ? "warning.main" : "error.main")}
                        >
                            {smije
                                ? (iznos === 0 ? "POVRATNA BESPLATNA" : `POVRATNA: ${iznos.toFixed(2)} EUR`)
                                : bezVeze
                                    ? "SEOP NIJE DOSTUPAN — PRAVO NIJE PROVJERENO"
                                    : "NEMA PRAVA NA POVRATNU NA OVOJ RELACIJI"}
                        </Typography>
                        {/* Bez veze je mjerodavan razlog lokalne odluke; poruka
                            posluzitelja je tada samo tehnicki opis ispada. */}
                        {bezVeze ? (
                            odlukaBezMreze?.razlog ? (
                                <Typography align="center" color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                                    {odlukaBezMreze.razlog}
                                </Typography>
                            ) : null
                        ) : (provjera.poruka || provjera.razlog) ? (
                            <Typography align="center" color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                                {provjera.razlog || provjera.poruka}
                            </Typography>
                        ) : null}
                        {smije && !cijenaRed ? (
                            <Alert severity="error">Za povratnu relaciju nije unesena otočna cijena.</Alert>
                        ) : null}
                        {smije && cijenaRed ? (
                            <Button variant="contained" color="success" fullWidth onClick={dodaj} sx={{ height: 80, fontSize: "1.15rem" }}>
                                {polaznaData
                                    ? `DODAJ OBJE KARTE ${(Number(polaznaData.free ? 0 : polaznaData.iznos || 0) + iznos).toFixed(2)} EUR`
                                    : (iznos === 0 ? "DODAJ POVRATNU (BESPLATNO)" : `DODAJ POVRATNU ${iznos.toFixed(2)} EUR`)}
                            </Button>
                        ) : null}
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
