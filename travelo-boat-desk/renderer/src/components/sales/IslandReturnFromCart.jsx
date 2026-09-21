import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle,
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
import IslandReturnModal from "./IslandReturnModal";

// Način 2: povratna OTOČNA za stavku koja je već u košarici. Otočna traži
// iskaznicu, pa se kartica MORA ponovo očitati (ili ručno unijeti) — polazna je
// prodana ranije i njezin identifikator se ne čuva. Nakon identifikacije otvara
// se isti IslandReturnModal (odabir datuma/polaska + svježa provjera + cijena),
// samo bez polazne (ona je već u košarici).

// Polazak/dolazak su tekst "DD.MM.YYYY. HH:mm"; travelDate je "DD/MM/YYYY".
const pocetniDatum = (stavka, travelDate) => {
    const t = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s/.exec(String(stavka?.departure || "").trim());
    if (t) return new Date(+t[3], +t[2] - 1, +t[1]);
    const e = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(travelDate || ""));
    return e ? new Date(+e[3], +e[2] - 1, +e[1]) : new Date();
};

export default function IslandReturnFromCart({ stavka, onClose }) {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    const [faza, setFaza] = useState("identifikacija"); // -> "povratak"
    const [kartica, setKartica] = useState(null);       // {vrsta, vrijednost, sustav, F2}
    const [ocitanaKartica, setOcitanaKartica] = useState(null); // puni objekt kartice (card_data)
    const [radi, setRadi] = useState(false);
    const [greska, setGreska] = useState("");

    // Ručni unos
    const [rucniSustav, setRucniSustav] = useState("SEOP");
    const [rucniOblik, setRucniOblik] = useState("card_no");
    const [rucniUnos, setRucniUnos] = useState("");

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
            setFaza("povratak");
        } catch (e) {
            setGreska(e?.message || "Greška pri očitavanju kartice.");
        } finally {
            setRadi(false);
        }
    };

    const nastaviRucno = () => {
        if (!rucniUnos.trim()) return;
        setOcitanaKartica(null);
        setKartica({ vrsta: rucniOblik, vrijednost: rucniUnos.trim(), sustav: rucniSustav, F2: null });
        setFaza("povratak");
    };

    // Blok povlastice bez redovne cijene relacije (nemamo selectedTripPrices u
    // košarici) — helper tada uzima cijenaRed.price kao redovnu.
    const blokPovlastice = (args) => buildBlokPovlastice({ ...args, redovnaCijena: null });

    // Dodavanje povratne u košaricu (append, kao i drugdje).
    const onDodaj = (data) => {
        const opisi = Array.isArray(data) ? data.filter(Boolean) : [data];
        let novi = [];
        for (const d of opisi) novi = [...novi, ...buildIslandTickets(d, { cardData: ocitanaKartica })];
        const postojece = appData.saleData?.addedTickets || [];
        dispatch(setStateData({ path: "saleData/addedTickets", value: [...postojece, ...novi] }));
    };

    if (faza === "povratak") {
        return (
            <IslandReturnModal
                open
                onClose={onClose}
                polaznaData={null}
                relacija={stavka}
                kartica={kartica}
                pocetniDatum={pocetniDatum(stavka, appData.searchData?.travelDate)}
                provjeriRutu={provjeriKarticuNaRuti}
                cijenaPovlastene={cijenaPovlastene}
                blokPovlastice={blokPovlastice}
                onDodaj={onDodaj}
            />
        );
    }

    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                Povratna otočna karta
                <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {stavka ? `${stavka.arrival_harbor_name} → ${stavka.departure_harbor_name}` : ""}
                    {" — očitajte iskaznicu"}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
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
                        <InputLabel id="rfc-sustav">Sustav</InputLabel>
                        <Select labelId="rfc-sustav" label="Sustav" value={rucniSustav} onChange={(e) => setRucniSustav(e.target.value)}>
                            <MenuItem value="SEOP">SEOP</MenuItem>
                            <MenuItem value="MOSI">MOSI</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={{ flex: 1 }}>
                        <InputLabel id="rfc-oblik">Upisuje se</InputLabel>
                        <Select labelId="rfc-oblik" label="Upisuje se" value={rucniOblik} onChange={(e) => setRucniOblik(e.target.value)}>
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
                <Button variant="outlined" fullWidth disabled={!rucniUnos.trim()} onClick={nastaviRucno} sx={{ height: 56 }}>
                    NASTAVI S RUČNIM UNOSOM
                </Button>
            </DialogContent>
            <Box sx={{ px: 3, py: 2, display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={onClose}>ODUSTANI</Button>
            </Box>
        </Dialog>
    );
}
