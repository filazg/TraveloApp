import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
    Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { allAppData, setStateData } from "../../store/appSlice";
import {
    identifikatorSKartice,
    provjeriKarticuNaRuti,
    cijenaPovlastene,
    blokPovlastice as buildBlokPovlastice,
    buildIslandTickets,
} from "./subsidisedHelpers";

// Skeniranje N iskaznica za povratnu OTOČNU na VEĆ ODABRANOJ povratnoj ruti
// (datum/polazak biraju se u ReturnTicketModal). Za svaku karticu: očitaj ili
// ručno unesi → svježa provjera prava na toj ruti → dodaj povratnu otočnu.
// Ide redom, karticu po karticu, dok se ne obradi zadani broj.

const vrijemeRute = (r) => {
    const m = String(r?.actual_departure || r?.departure || "").match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : "";
};

export default function IslandReturnScanner({ ruta, kolicina, onClose }) {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    const [indeks, setIndeks] = useState(1);            // trenutna kartica (1..kolicina)
    const [faza, setFaza] = useState("identifikacija"); // -> "provjera"
    const [kartica, setKartica] = useState(null);
    const [ocitanaKartica, setOcitanaKartica] = useState(null);
    const [provjera, setProvjera] = useState(null);
    const [radi, setRadi] = useState(false);
    const [greska, setGreska] = useState("");

    const [rucniSustav, setRucniSustav] = useState("SEOP");
    const [rucniOblik, setRucniOblik] = useState("card_no");
    const [rucniUnos, setRucniUnos] = useState("");

    // Otočna cijena odabrane povratne rute (par luka, oba smjera).
    const cijenaRed = useMemo(() => {
        if (!ruta) return null;
        const sve = appData.transportData?.route_prices || [];
        return sve.find((p) => p.timetable_uuid === ruta.timetable_uuid
            && p.is_island === true
            && p.is_active !== false
            && ((p.harbor_from_code === ruta.departure_harbor_id && p.harbor_to_code === ruta.arrival_harbor_id)
                || (p.harbor_to_code === ruta.departure_harbor_id && p.harbor_from_code === ruta.arrival_harbor_id))) || null;
    }, [ruta, appData.transportData]);

    const provjeriKarticu = async (k, ident) => {
        setRadi(true);
        setProvjera(null);
        try {
            const ishod = await provjeriKarticuNaRuti({
                vrsta: ident.vrsta,
                vrijednost: ident.vrijednost,
                sustav: ident.sustav || "SEOP",
                kartica: k?.F2 || null,
                route: {
                    line_no: ruta.line_code,
                    departure_harbor_code: ruta.departure_harbor_id,
                    arrival_harbor_code: ruta.arrival_harbor_id,
                },
                date: ruta.actual_departure || ruta.departure,
            });
            setProvjera(ishod);
            setFaza("provjera");
        } finally {
            setRadi(false);
        }
    };

    const ocitaj = async () => {
        setGreska("");
        setRadi(true);
        try {
            const reader = appData.basicData?.settings?.card_reader;
            const res = await window.api.app.readTesseraIPC(reader);
            if (!res?.ok) {
                setGreska(`Greška (${res?.stage || "čitač"}): ${res?.error || "kartica se ne može očitati"}`);
                return;
            }
            const k = res.data?.data;
            const ident = identifikatorSKartice(k);
            if (!ident) {
                setGreska("Nepriznata kartica. Pokušajte ponovo ili unesite broj ručno.");
                return;
            }
            setOcitanaKartica(k);
            setKartica({ ...ident, F2: k?.F2 || null });
            await provjeriKarticu(k, ident);
        } catch (e) {
            setGreska(e?.message || "Greška pri očitavanju kartice.");
        } finally {
            setRadi(false);
        }
    };

    const nastaviRucno = async () => {
        if (!rucniUnos.trim()) return;
        const ident = { vrsta: rucniOblik, vrijednost: rucniUnos.trim(), sustav: rucniSustav };
        setOcitanaKartica(null);
        setKartica({ ...ident, F2: null });
        await provjeriKarticu(null, ident);
    };

    const smije = provjera?.smije_se_prodati === true;
    const iznos = provjera && cijenaRed ? cijenaPovlastene(provjera, cijenaRed) : 0;

    const naSljedecu = () => {
        if (indeks >= kolicina) { onClose(); return; }
        setIndeks((i) => i + 1);
        setFaza("identifikacija");
        setKartica(null);
        setOcitanaKartica(null);
        setProvjera(null);
        setGreska("");
        setRucniUnos("");
    };

    const dodaj = () => {
        if (!cijenaRed || !smije) return;
        const data = {
            price: cijenaRed,
            rights: {},
            type: kartica?.sustav || "SEOP",
            free: iznos === 0,
            iznos,
            povlastica: buildBlokPovlastice({ ishod: provjera, cijenaRed, redovnaCijena: null }),
            route: ruta,
        };
        const novi = buildIslandTickets(data, { cardData: ocitanaKartica });
        const postojece = appData.saleData?.addedTickets || [];
        dispatch(setStateData({ path: "saleData/addedTickets", value: [...postojece, ...novi] }));
        naSljedecu();
    };

    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                Povratna otočna — iskaznica {indeks}/{kolicina}
                <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {ruta ? `${ruta.departure_harbor_name} → ${ruta.arrival_harbor_name} · ${vrijemeRute(ruta)} · linija ${ruta.line_code || ""}` : ""}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {!cijenaRed ? (
                    <Alert severity="error">Za povratnu relaciju nije unesena otočna cijena. Otočne se ne mogu prodati.</Alert>
                ) : faza === "identifikacija" ? (
                    <>
                        <Button
                            variant="contained"
                            fullWidth
                            disabled={radi}
                            onClick={ocitaj}
                            startIcon={radi ? <CircularProgress size={18} color="inherit" /> : <CreditCardIcon />}
                            sx={{ height: 72, fontSize: "1.1rem", mb: 2 }}
                        >
                            {radi ? "OČITAVANJE…" : "OČITAJ KARTICU"}
                        </Button>
                        {greska ? <Alert severity="error" sx={{ mb: 2 }}>{greska}</Alert> : null}
                        <Divider sx={{ mb: 2 }}>ili ručni unos</Divider>
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                            <FormControl sx={{ flex: 1 }}>
                                <InputLabel id="irs-sustav">Sustav</InputLabel>
                                <Select labelId="irs-sustav" label="Sustav" value={rucniSustav} onChange={(e) => setRucniSustav(e.target.value)}>
                                    <MenuItem value="SEOP">SEOP</MenuItem>
                                    <MenuItem value="MOSI">MOSI</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl sx={{ flex: 1 }}>
                                <InputLabel id="irs-oblik">Upisuje se</InputLabel>
                                <Select labelId="irs-oblik" label="Upisuje se" value={rucniOblik} onChange={(e) => setRucniOblik(e.target.value)}>
                                    <MenuItem value="card_no">Broj iskaznice</MenuItem>
                                    <MenuItem value="oib">OIB</MenuItem>
                                    <MenuItem value="iks">Broj iksice</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                        <TextField
                            fullWidth
                            label={rucniOblik === "oib" ? "OIB" : rucniOblik === "iks" ? "Broj iksice" : "Broj iskaznice"}
                            value={rucniUnos}
                            onChange={(e) => setRucniUnos(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <Button variant="outlined" fullWidth disabled={!rucniUnos.trim() || radi} onClick={nastaviRucno} sx={{ height: 56 }}>
                            {radi ? "PROVJERA…" : "PROVJERI RUČNI UNOS"}
                        </Button>
                    </>
                ) : (
                    <>
                        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} alignItems="center">
                            <Chip size="small" label={kartica?.sustav || "SEOP"} />
                            <Typography variant="body2" color="text.secondary">{kartica?.vrijednost}</Typography>
                        </Stack>
                        <Typography align="center" sx={{ fontWeight: 800, py: 0.5 }} color={smije ? "success.main" : "error.main"}>
                            {smije
                                ? (iznos === 0 ? "POVRATNA BESPLATNA" : `POVRATNA: ${iznos.toFixed(2)} EUR`)
                                : "NEMA PRAVA NA POVRATNU NA OVOJ RELACIJI"}
                        </Typography>
                        {provjera?.razlog || provjera?.poruka ? (
                            <Typography align="center" color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                                {provjera.razlog || provjera.poruka}
                            </Typography>
                        ) : null}
                        {smije ? (
                            <Button variant="contained" color="success" fullWidth onClick={dodaj} sx={{ height: 72, fontSize: "1.1rem", mt: 1 }}>
                                {iznos === 0 ? "DODAJ POVRATNU (BESPLATNO)" : `DODAJ POVRATNU ${iznos.toFixed(2)} EUR`}
                            </Button>
                        ) : (
                            <Button variant="outlined" fullWidth onClick={naSljedecu} sx={{ height: 56, mt: 1 }}>
                                {indeks >= kolicina ? "ZATVORI" : "PRESKOČI OVU KARTICU"}
                            </Button>
                        )}
                    </>
                )}
            </DialogContent>
            <Box sx={{ px: 3, py: 2, display: "flex", justifyContent: "space-between" }}>
                <Button color="inherit" onClick={onClose}>PREKINI</Button>
                {faza === "provjera" && smije ? (
                    <Button onClick={naSljedecu}>{indeks >= kolicina ? "ZAVRŠI" : "PRESKOČI"}</Button>
                ) : null}
            </Box>
        </Dialog>
    );
}
