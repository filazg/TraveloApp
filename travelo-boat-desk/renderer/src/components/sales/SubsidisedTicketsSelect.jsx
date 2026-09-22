import React, { useMemo, useState } from "react";
import { alpha, Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem, Modal, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { allAppData, resetStateData, setStateData } from "../../store/appSlice";
import IslandReturnModal from "./IslandReturnModal";
import {
  identifikatorSKartice,
  provjeriKarticuNaRuti,
  cijenaPovlastene,
  popustBezMreze,
  blokPovlastice as buildBlokPovlastice,
  buildIslandTickets,
} from "./subsidisedHelpers";

// Razlozi izdavanja otočne bez provjere (Kontrola → Greške s povlaštenim
// karticama). Ključevi moraju odgovarati onima na backendu/portalu i mobilnoj.
const RAZLOZI_GRESKE = [
    { kljuc: "nemoguce_ocitati", naziv: "Nemoguće očitati karticu" },
    { kljuc: "kartica_ostecena", naziv: "Kartica oštećena" },
    { kljuc: "greska_oprema", naziv: "Greška na opremi" },
    { kljuc: "prekid_komunikacije", naziv: "Prekid u komunikaciji" },
];

// Ploha koja nosi ishod provjere kartice. Ton zamjenjuje zatečene tvrdo
// kodirane boje (#ffeb3b za važeću, #f28b82 za nevažeću, lightgray za MOSI) —
// one su bile iste u svijetloj i tamnoj temi, pa je tekst na njima znao nestati.
function StatusPanel({ tone = "neutral", title, children }) {
    const key = tone === "neutral" ? "primary" : tone;
    return (
        <Paper
            variant="outlined"
            sx={{
                borderRadius: 3,
                p: 1.5,
                bgcolor: (t) => alpha(t.palette[key].main, t.palette.mode === "dark" ? 0.18 : 0.1),
                borderColor: (t) => alpha(t.palette[key].main, 0.5),
            }}
        >
            {title ? (
                <Typography
                    align="center"
                    variant="body2"
                    sx={{ fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", mb: 1 }}
                    color={tone === "neutral" ? "text.primary" : `${key}.main`}
                >
                    {title}
                </Typography>
            ) : null}
            {children}
        </Paper>
    );
}

// Bijela kartica s podacima unutar plohe.
function InfoCard({ title, children }) {
    return (
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, p: 2, borderRadius: 3, bgcolor: "background.paper" }}>
            <Typography
                align="center"
                variant="subtitle2"
                color="text.secondary"
                sx={{ fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}
            >
                {title}
            </Typography>
            <Divider sx={{ my: 1 }} />
            {children}
        </Paper>
    );
}

// Oznaka i vrijednost jedno uz drugo, za podatke koji se samo citaju u prolazu
// (podaci s ocitane kartice). Zauzima jedan redak umjesto cijelog stupca.
function SitnoPolje({ oznaka, vrijednost }) {
    return (
        <Stack direction="row" spacing={0.5} alignItems="baseline">
            <Typography variant="body2" color="text.secondary">{oznaka}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{vrijednost || '—'}</Typography>
        </Stack>
    );
}

function DetailRow({ label, value }) {
    return (
        <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.5 }}>
            <Typography color="text.secondary">{label}</Typography>
            <Typography sx={{ fontWeight: 700, textAlign: "right" }}>{value}</Typography>
        </Stack>
    );
}

export default function SubsidisedTicketsSelect() {
    const dispatch = useDispatch()
    const appData = useSelector(allAppData);
    const [cardData, setCardData] = useState(null);
    const [virtualCardData, setVirtualCardData] = useState(false);
    const [selectedCode, setSelectedCode] = useState("");
    const [textValue, setTextValue] = useState("");

  
    
    const handleCloseSubsidizedModal = () => {
        setCardData(null);
        setSelectedCode("")
        setTextValue("")
        setProvjera(null)
        setRucniUnos("")
        setRucniSustav("SEOP")
        setPratnjaOdabrana(false)
        setGreskaRazlog(null)
        setGreskaNapomena("")
        setPovratnaOtvoreno(false)
        dispatch(setStateData({path:'modalsStates/showSubsidisedTickets', value: false}))
    };

    const handleCloseSubsidizedDataModal = () => {
        dispatch(setStateData({path:'modalsStates/showSubsidisedTicketsData', value: false}))
    };

     const handleVirtualCard = ()=>{
      setVirtualCardData(true)
    }

    // Provjera prava ide na posluzitelj — i kad je kartica procitana, i kad se
    // broj upisuje rucno.
    //
    // Prije se odluka donosila ovdje, iz sadrzaja cipa i lokalne tablice prava.
    // To znaci da svaka promjena pravila (druga linija, drugi postotak, novo
    // pravo u Pravilniku) trazi novi build blagajne. Sada blagajna pita, a
    // posluzitelj odgovara smije li se prodati, koliki je popust i putuje li
    // pratnja besplatno — i uz to vraca zapecaceni zapis koji ide s prodajom.
    //
    // Rucni upis postoji jer se cip ne da uvijek procitati: istrosena kartica,
    // citac koji ne reagira, iskaznica koju putnik nema kod sebe.
    const [rucniOblik, setRucniOblik] = useState("card_no");
    // Kod rucnog upisa blagajnik mora odabrati na koji se sustav identifikator
    // odnosi — SEOP (otocna) ili MOSI (invalidska). Provjera i cijena razlikuju
    // se po sustavu: SEOP ide s otocne cijene, MOSI s redovne (MOSI-only linije
    // nemaju otocnu cijenu).
    const [rucniSustav, setRucniSustav] = useState("SEOP");
    const [rucniUnos, setRucniUnos] = useState("");
    const [provjera, setProvjera] = useState(null);
    const [provjeraRadi, setProvjeraRadi] = useState(false);
    const [pratnjaOdabrana, setPratnjaOdabrana] = useState(false);
    // Kad se pravo ne može potvrditi (kartica se ne da očitati/provjeriti), otočna
    // se izdaje na povjerenje po povlaštenoj cijeni, ali uz obavezan razlog.
    const [greskaRazlog, setGreskaRazlog] = useState(null);
    const [greskaNapomena, setGreskaNapomena] = useState("");

    // --- Povratna otočna karta (zaseban modal IslandReturnModal) ------------
    // Odabir datuma + povratnog polaska, svježa provjera i cijena su u modalu;
    // ovdje samo držimo je li otvoren + zajedničke helpere koje modal koristi.
    const [povratnaOtvoreno, setPovratnaOtvoreno] = useState(false);
    // Podaci polazne karte (isti oblik kao IZNOS gumb) zapamćeni u trenutku klika
    // na PRODAJ POVRATNU — modal doda i polaznu i povratnu odjednom (povratno
    // putovanje = oba smjera).
    const [polaznaData, setPolaznaData] = useState(null);

    // Sustav aktivne kartice (MOSI ne smije otići kao SEOP): iz očitane kartice
    // (cardFamily), inače iz ručnog odabira.
    const sustavKartice = () => {
        if (cardData?.cardFamily === "MOSI") return "MOSI";
        if (cardData?.cardFamily === "SEOP_P") return "SEOP";
        return provjera?.sustav || rucniSustav || "SEOP";
    };

    // Identifikator za provjeru povratne MORA biti isti onaj kojim je provjerena
    // polazna: očitana kartica → broj s kartice; ručni upis → točno upisani broj
    // (rucniUnos), ne ono što je posluzitelj eventualno vratio u identifikatoru.
    const aktivniIdentifikator = () => {
        const sKartice = identifikatorSKartice(cardData);
        if (sKartice) return sKartice;
        return { vrsta: rucniOblik, vrijednost: rucniUnos, sustav: rucniSustav };
    };

    // Zadani datum povratka = odabrani datum putovanja ("DD/MM/YYYY" → Date).
    const pocetniDatumPovratka = () => {
        const m = String(appData.searchData?.travelDate || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date();
    };

    const provjeriNaPosluzitelju = async ({ vrsta, vrijednost, sustav = "SEOP", kartica = null }) => {
      const broj = String(vrijednost || "").trim();
      if (!broj) return null;

      const relacija = appData.searchData?.selectedTrip;
      const linija = appData.searchData?.selectedLine;
      if (!relacija || !linija) {
        const ishod = { ok: false, smije_se_prodati: false, poruka: "Odaberite polazak i odredište prije provjere." };
        setProvjera(ishod);
        return ishod;
      }

      setProvjeraRadi(true);
      setPratnjaOdabrana(false);
      setGreskaRazlog(null);
      setGreskaNapomena("");
      try {
        const ishod = await provjeriKarticuNaRuti({
          vrsta, vrijednost, sustav, kartica,
          route: {
            line_no: linija.code,
            departure_harbor_code: relacija.departure_harbor_id,
            arrival_harbor_code: relacija.arrival_harbor_id,
          },
          date: relacija.departure,
        });
        setProvjera(ishod);
        return ishod;
      } finally {
        setProvjeraRadi(false);
      }
    };

    const provjeriRucno = () => provjeriNaPosluzitelju({ vrsta: rucniOblik, vrijednost: rucniUnos, sustav: rucniSustav });

    const scanCard = async()=>{
      console.log('BRAVO')
      const getCardData = await window.api.e_getNFCCard()
      console.log(getCardData)
      await dispatch(setTransportData({path:'cardData', value:getCardData}))
      await dispatch(setStateData({path:'showSubsidisedTickets', value: false}))
      if(getCardData){
      await dispatch(setStateData({path:'showSubsidisedTicketsData', value: true}))
      }
    }
   
    async function readCard() {
      await dispatch(setStateData({path:'status', value:'loading'}))
      await dispatch(setStateData({path:'loadingText', value:'Očitavanje podataka sa kartice...'}))
      setVirtualCardData(false)
      setCardData(null);
      //const reader = document.getElementById("reader").value;
      //const reader = "ACS ACR1281 1S Dual Reader PICC 0";
      const reader = appData.basicData.settings.card_reader;
      const res = await window.api.app.readTesseraIPC(reader);
        console.log('RESSS SA KARTICE', res)
      if (!res.ok) {
        console.log('GREŠKA', res.error)
        console.log('GREŠKA', res.stage)
        alert(`Greška (${res.stage}): ${res.error}`);
        return;
      }
      setCardData(res.data.data);
      console.log("Kartica:", res.meta);
      console.log("Podaci:", res.data);
      // Cip kaze tko je putnik; smije li povlastenu kartu na ovoj liniji, kaze
      // posluzitelj.
      const ident = identifikatorSKartice(res.data.data);
      if (ident) {
        await provjeriNaPosluzitelju({ ...ident, kartica: res.data.data.F2 || null });
      } else {
        setProvjera(null);
      }
      await dispatch(setStateData({path:'status', value:'ready'}))
    }
function cardDataToShow() {
    if (!cardData) {
      return "Nema podataka";
    }else{
      if(cardData.cardFamily==='SEOP_P'){
        return(
          cardData.F2.IslandName
        )
      }else if(cardData.cardFamily==='MOSI'){
        return(
          cardData.F2.Prezime
        )
      }else{
        return(
          "Nepriznata kartica" + cardData.cardFamily
        )
      }
    }
}

// Redovna cijena relacije — ide u dojavu kao redovCijenaEur, a sluzi i kao
// cijena karte kad se prodaje bez potvrdenog prava.
function redovnaCijenaRelacije() {
  const cijene = appData.searchData?.selectedTripPrices || [];
  const redovna = cijene.find((c) => c.is_island !== true && /redov/i.test(c.ticket_type_name || ""));
  return redovna || cijene.find((c) => c.is_island !== true) || null;
}

// Blok povlastice — tanki wrapper oko zajedničkog helpera koji dodaje redovnu
// cijenu relacije (čita se iz selectedTripPrices, pa mora ostati u komponenti).
function blokPovlastice({ ishod, cijenaRed, pratnja = false, uvijekProdaj = false, bezMreze = null }) {
  return buildBlokPovlastice({
    ishod, cijenaRed, pratnja, uvijekProdaj, bezMreze,
    kartica: cardData?.F2 || null,
    redovnaCijena: redovnaCijenaRelacije()?.price ?? null,
  });
}

// Odluka o popustu kad posluzitelj nije odgovorio.
//
// Sve ulazi iz onoga sto je vec sinkronizirano: sifarnik popusta po pravu, dvije
// postavke linije i SEOP-otoci luka relacije. Cip daje pravo i otok. Kad nesto
// od toga nedostaje, helper vraca „bez popusta" s razlogom — blagajna tada nudi
// samo dosadasnji put, izdavanje uz razlog.
function odlukaBezMreze() {
  const relacija = appData.searchData?.selectedTrip;
  const luke = appData.transportData?.harbors || [];
  const kodovi = [relacija?.departure_harbor_id, relacija?.arrival_harbor_id]
    .map((c) => String(c || "").trim())
    .filter(Boolean);

  return popustBezMreze({
    popusti: appData.basicData?.seop_right_discounts || [],
    pravo: cardData?.F2?.BasicRight || null,
    otokKartice: cardData?.F2?.IslandName || null,
    linija: appData.searchData?.selectedLine || null,
    luke: luke.filter((l) => kodovi.includes(String(l?.code || "").trim())),
  });
}

//DODAVANJE KARATA
const handleAddTickets = async(data) => {
  // Prima jedan opis (jednosmjerna) ili niz opisa (povratno = polazna+povratna).
  // Sve karte se grade i dodaju na POSTOJEĆU kosaricu JEDNIM dispatchom — ne
  // pregazi je i ne oslanja se na medju-render (stari appData u closure-u).
  const opisi = Array.isArray(data) ? data.filter(Boolean) : [data];
  let novi = [];
  for (const d of opisi) novi = [...novi, ...buildIslandTickets(d, { cardData, fallbackRoute: appData.searchData.selectedTrip })];
  const ticketsToAdd = [...(appData.saleData?.addedTickets || []), ...novi];
  dispatch(setStateData({path:'saleData/addedTickets' ,value: ticketsToAdd }));
  handleCloseSubsidizedModal()
  dispatch(resetStateData({path:'searchData/selectedTrip'}))
    dispatch(resetStateData({path:'searchData/selectedTripPrices'}))
    dispatch(resetStateData({path:'searchData/ticketsCounter'}))

    //await dispatch(setStateData({path:'status', value:'ready'}))
  };






// Opisi prava iz Pravilnika. Prikaz ih vise ne koristi — blagajnik na ekranu
// vidi samo sifru — ali popis ostaje: sluzi kao jedino mjesto gdje pise sto koja
// sifra znaci, dok se ne odluci hoce li ici u sifarnik.
// eslint-disable-next-line no-unused-vars
const seopRights = [
  {
    id:1,
    code: '01P',
    description: 'Djeca od navršene 3 do navršenih 12 godina s prebivalištem na otoku imaju pravo na neograničen broj putovanja s popustom.',
    message:'',
    freeTicket:false
  },
  {
    id:2,
    code: '02P',
    description: 'Osobe s prebivalištem na otoku (redovni korisnici). ',
    msg:'',
    freeTicket:false
  },
  {
    id:3,
    code: '03K',
    description: 'Učenici koji svakodnevno putuju od mjesta prebivališta na otoku do škole.',
    msg:'',
    freeTicket:true
  },
  {
    id:4,
    code: '03Ka',
    description: 'Učenici koji pohađaju školu na otoku svog prebivališta.',
    msg:'',
    freeTicket:true
  },
  {
    id:5,
    code: '03Kb',
    description: 'Predškolci koji pohađaju obvezni predškolski program na otoku svoga prebivališta.',
    msg:'',
    freeTicket:true
  },
  {
    id:6,
    code: '03Kc',
    description: 'Predškolci, koji pohađaju obvezni predškolski program izvan otoka svoga prebivališta.',
    msg:'',
    freeTicket:true
  },
  {
    id:7,
    code: '04K',
    description: 'Studenti koji svakodnevno putuju od mjesta prebivališta na otoku do visokoškolske ustanove.',
    msg:'',
    freeTicket:true
  },
  {
    id:8,
    code: '04Ka',
    description: 'Studenti koji pohađaju visokoškolsku ustanovu na otoku svog prebivališta.',
    msg:'',
    freeTicket:true
  },
  {
    id:9,
    code: '05K',
    description: 'Učenici koji zbog školovanja privremeno borave izvan otoka.',
    msg:'',
    freeTicket:true
  },
  {
    id:10,
    code: '06K',
    description: 'Studenti koji zbog studija privremeno borave izvan otoka.',
    msg:'',
    freeTicket:true
  },
  {
    id:11,
    code: '07B',
    description: 'Umirovljenici s prebivalištem na otoku druge skupine (razvijeni otoci).',
    msg:'',
    freeTicket:true
  },
  {
    id:12,
    code: '08B',
    description: 'Osobe starije od 65 godina s prebivalištem na otoku druge skupine (razvijeni otoci).',
    msg:'',
    freeTicket:true
  },
  {
    id:13,
    code: '09B',
    description: 'Umirovljenici s prebivalištem na otocima prve skupine (nerazvijeni otoci).',
    msg:'',
    freeTicket:true
  },
  {
    id:14,
    code: '10B',
    description: 'Osobe starije od 65 godina s prebivalištem na otocima prve skupine (nerazvijeni otoci).',
    msg:'',
    freeTicket:false
  },
  {
    id:15,
    code: '11P',
    description: 'Djeca od navršene 3 do navršenih 12 godina koja nemaju prebivalište na otoku (evidentira se na „virtualnu“ iskaznicu).',
    msg:'',
    freeTicket:false
  },
  {
    id:16,
    code: '16B',
    description: 'Sva djeca od navršene 1 do navršenih 3 godine - primjenjuje se na otočnu i ne otočnu djecu.',
    msg:'',
    freeTicket:true
  },
  {
    id:17,
    code: '17P',
    description: 'Djelatnici javnih službi čije je stalno mjesto rada na otoku imaju pravo na prijevoz s popustom na linijama koje povezuju taj otok s kopnom ili drugim otokom i iznimkama iz Priloga 1 Pravilnika koje se odnose na taj otok.',
    msg:'',
    freeTicket:false
  },
  {
    id:18,
    code: '19P',
    description: 'ZDRAVSTVENI DJELATNICI pri obavljanju redovitih prijevoza bolesnika imaju pravo na prijevoz s popustom na svim linijama.',
    msg:'',
    freeTicket:false
  },
  {
    id:19,
    code: '21B',
    description: 'DJELATNICI JAVNIH ZDRAVSTVENIH SLUŽBI pri obavljanju sanitetskih prijevoza bolesnika sa otoka na kopno i obrnuto i DJELATNICI POLICIJE pri obavljanju dužnosti na otocima imaju pravo na besplatni prijevoz.',
    msg:'',
    freeTicket:true
  },
  {
    id:20,
    code: '23P',
    description: 'Djelatnici javnih službi sa iskaznicama kategorija 17P i 19P  koje se privremeno bilježe na virtualne iskaznice imaju pravo na prijevoz sa popustom ',
    msg:'',
    freeTicket:false
  }
  
]

const virtualSeopCards =[
  {
    "id": 1,
    "code": "6999976",
    "description": "pratnja osobe s invaliditetom i djeca s teškoćama u razvoju (koji nemaju prebivalište na otoku) kojima je utvrđen III. ili IV. stupanj funkcionalnog oštećenja",
    "free": true,
    "label": "39B"
  },
  {
    "id": 2,
    "code": "6999977",
    "description": "osobe s invaliditetom i djeca s teškoćama u razvoju (koji nemaju prebivalište na otoku) kojima je utvrđen III. ili IV. stupanj funkcionalnog oštećenja",
    "free": true,
    "label": "38B"
  },
  {
    "id": 3,
    "code": "6999978",
    "description": "pratnja osoba s invaliditetom (koji nemaju prebivalište na otoku) kod kojih je utvrđeno tjelesno oštećenje donjih ekstremiteta 80 % ili više, hrvatske ratne vojne invalide sa 100 %-tnim tjelesnim oštećenjem, osobe kojima je utvrđeno tjelesno oštećenje osjetila vida od 100 %, gluhoslijepe osobe sa 100 %-tnim tjelesnim oštećenjem",
    "free": true,
    "label": "36B"
  },
  {
    "id": 4,
    "code": "6999979",
    "description": "osobe s invaliditetom (koji nemaju prebivalište na otoku) kod kojih je utvrđeno tjelesno oštećenje donjih ekstremiteta 80 % ili više, hrvatske ratne vojne invalide sa 100 %-tnim tjelesnim oštećenjem, osobe kojima je utvrđeno tjelesno oštećenje osjetila",
    "free": true,
    "label": "35B"
  },
  {
    "id": 5,
    "code": "6999980",
    "description": "osobe s invaliditetom (koji imaju prebivalište na otoku) kod kojih je utvrđeno tjelesno oštećenje donjih ekstremiteta 80 % ili više, hrvatske ratne vojne invalide sa 100 %-tnim tjelesnim oštećenjem, osobe kojima je utvrđeno tjelesno oštećenje osjetila vida od 100 %, gluhoslijepe osobe sa 100 %-tnim tjelesnim oštećenjem",
    "free": true,
    "label": "27B"
  },
  {
    "id": 6,
    "code": "6999981",
    "description": "pratnja osoba s invaliditetom (koji imaju prebivalište na otoku) kod kojih je utvrđeno tjelesno oštećenje donjih ekstremiteta 80 % ili više, hrvatske ratne vojne invalide sa 100 %-tnim tjelesnim oštećenjem, osobe kojima je utvrđeno tjelesno oštećenje osjetila vida od 100 %, gluhoslijepe osobe sa 100 %-tnim tjelesnim oštećenjem",
    "free": true,
    "label": "28B"
  },
  {
    "id": 7,
    "code": "6999982",
    "description": "virtualna iskaznica za osobe oružanih snaga za prijevoz s popustom",
    "free": false,
    "label": ""
  },
  {
    "id": 8,
    "code": "6999983",
    "description": "osobe s invaliditetom i djeca s teškoćama u razvoju (koji imaju prebivalište na otoku) kojima je utvrđen III. ili IV. stupanj funkcionalnog oštećenja",
    "free": true,
    "label": "30B"
  },
  {
    "id": 9,
    "code": "6999984",
    "description": "pratnja osobe s invaliditetom i djeca s teškoćama u razvoju (koji imaju prebivalište na otoku) kojima je utvrđen III. ili IV. stupanj funkcionalnog oštećenja",
    "free": true,
    "label": "31B"
  },
  {
    "id": 10,
    "code": "6999985",
    "description": "virtualna iskaznica za osobe lučke kapetanija za prijevoz s popustom",
    "free": false,
    "label": ""
  },
  {
    "id": 11,
    "code": "6999986",
    "description": "virtualna iskaznica za osobe Gorske službe spašavanja za prijevoz s popustom",
    "free": false,
    "label": ""
  },
  {
    "id": 12,
    "code": "6999987",
    "description": "virtualna iskaznica osobe za vatrogasce za prijevoz s popustom",
    "free": false,
    "label": ""
  },
  {
    "id": 13,
    "code": "6999988",
    "description": "virtualna iskaznica za osobe za policiju za prijevoz s popustom",
    "free": false,
    "label": ""
  },
  {
    "id": 14,
    "code": "6999989",
    "description": "virtualna iskaznica za osobe za zdravstvene djelatnike za prijevoz s popustom",
    "free": false,
    "label": ""
  },
  {
    "id": 15,
    "code": "6999990",
    "description": "djeca s teškoćama u razvoju koja imaju prebivalište na otoku",
    "free": true,
    "label": "32B"
  },
  {
    "id": 16,
    "code": "6999991",
    "description": "pratnja djece s teškoćama u razvoju koja imaju prebivalište na otoku",
    "free": true,
    "label": "33B"
  },
  {
    "id": 17,
    "code": "6999992",
    "description": "virtualna iskaznica za osobe za oružane snage za besplatni prijevoz",
    "free": true,
    "label": ""
  },
  {
    "id": 18,
    "code": "6999993",
    "description": "virtualna iskaznica za djecu od 1 do 3 godina sa i bez prebivalište na otoku",
    "free": true,
    "label": ""
  },
  {
    "id": 19,
    "code": "6999994",
    "description": "virtualna iskaznica za djecu od 1 do 3 godina koja nemaju prebivalište na otoku",
    "free": true,
    "label": ""
  },
  {
    "id": 20,
    "code": "6999995",
    "description": "virtualna iskaznica za osobe lučke kapetanije",
    "free": true,
    "label": ""
  },
  {
    "id": 21,
    "code": "6999996",
    "description": "virtualna iskaznica za osobe Gorske službe spašavanja",
    "free": true,
    "label": ""
  },
  {
    "id": 22,
    "code": "6999997",
    "description": "virtualna iskaznica za vatrogasce",
    "free": true,
    "label": ""
  },
  {
    "id": 23,
    "code": "6999998",
    "description": "virtualna iskaznica za policiju",
    "free": true,
    "label": ""
  },
  {
    "id": 24,
    "code": "6999999",
    "description": "virtualna iskaznica za zdravstvene radnike",
    "free": true,
    "label": ""
  }
]



// Postotak popusta za prikaz. Kad je posluzitelj odgovorio, vrijedi njegova
// odluka; bez mreze vrijedi sifarnik. Na liniji koja popust ne primjenjuje
// cijena ide iz cjenika, pa postotak ne bi bio istina.
function popustZaPrikaz() {
  if (provjera?.smije_se_prodati === true && provjera?.primjeni_popust !== true) return 'po cjeniku';
  if (provjera?.primjeni_popust === true && provjera?.popust_postotak != null) return `${provjera.popust_postotak} %`;
  const bezMreze = provjera?.offline === true ? odlukaBezMreze() : null;
  if (bezMreze?.primijenjen) return `${bezMreze.popust_postotak} %`;
  const izSifarnika = (appData.basicData?.seop_right_discounts || [])
    .find((p) => String(p.code) === String(cardData?.F2?.BasicRight));
  return izSifarnika?.discount_pct != null ? `${izSifarnika.discount_pct} %` : '—';
}

function seopCardDetails() {
  // Odluku donosi posluzitelj (SEOP + postavke linije); kartica sluzi za prikaz
  // podataka o vlasniku i za identifikaciju.
  //
  // Prikazuje se samo ono po cemu blagajnik odlucuje: tko je, koje pravo, koliki
  // popust i za koji otok. Adresa i mjesto prebivalista su izbaceni — otok pise
  // posebno, a stupac je zbog njih bio dvostruko duzi.
  const priceForSeopTicket = appData.searchData?.selectedTripPrices?.find((price) => price.is_island === true)
  const smije = provjera?.smije_se_prodati === true
  return(
    <StatusPanel tone={smije ? "success" : "error"} title="Otočna kartica SEOP_P">
      {/* Podaci s cipa stanu u jedan uski red: ime, pa cetiri para oznaka-vrijednost.
          Bijele kartice s naslovima i opis sifre su maknuti — zauzimali su vise
          mjesta nego podaci, a prostor treba odluci i gumbima ispod. */}
      <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>
        {`${cardData.F2.FirstName} ${cardData.F2.Surname}`}
      </Typography>
      <Stack direction="row" flexWrap="wrap" columnGap={2} sx={{ mt: 0.25, mb: 1 }}>
        <SitnoPolje oznaka="OIB" vrijednost={cardData.F2.OIB} />
        <SitnoPolje oznaka="Kartica" vrijednost={cardData.F2.CardNumber} />
        <SitnoPolje oznaka="Pravo" vrijednost={cardData.F2.BasicRight} />
        <SitnoPolje oznaka="Popust" vrijednost={popustZaPrikaz()} />
        <SitnoPolje oznaka="Otok" vrijednost={cardData.F2.IslandName} />
        <SitnoPolje
          oznaka="Vrijedi do"
          vrijednost={`${cardData.F2.ExpirationDate.Day}/${cardData.F2.ExpirationDate.Month}/${cardData.F2.ExpirationDate.Year}`}
        />
      </Stack>

      {odlukaIGumbi(priceForSeopTicket, 'SEOP')}
    </StatusPanel>
  )
}

// Ponuda povlaštene karte s lokalnim popustom — samo kad je veza pala, a čip je
// pročitan. Ručni upis broja iskaznice ovdje ne prolazi: bez čipa se ne zna
// pravo, a bez prava nema po čemu odrediti popust.
function ponudiLokalniPopust(cijenaRed, sustav) {
  if (sustav !== "SEOP") return null;
  if (provjera?.offline !== true) return null;
  if (!cardData?.F2?.BasicRight || !cijenaRed) return null;

  const odluka = odlukaBezMreze();
  if (!odluka.primijenjen) {
    // Zasto popusta nema treba pisati: inace izgleda kao da mogucnost ne radi.
    return (
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {odluka.razlog}
      </Typography>
    );
  }

  const iznos = +(Number(cijenaRed.price) * (1 - odluka.popust_postotak / 100)).toFixed(2);
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
        Bez veze sa SEOP-om — popust po pravu s kartice
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1.5 }}>
        {odluka.razlog} Karta se bilježi kao prodana bez provjere i vidi se u Kontroli.
      </Typography>
      <Button
        variant="contained"
        color="success"
        onClick={() => {
          handleAddTickets({
            price: cijenaRed, rights: {}, type: sustav, free: iznos === 0,
            iznos,
            povlastica: blokPovlastice({ ishod: provjera, cijenaRed, bezMreze: odluka }),
          })
        }}
        sx={{ height: 88, width: "100%", fontSize: "1.25rem" }}
      >
        {iznos === 0
          ? `BESPLATNA KARTA (POPUST ${odluka.popust_postotak}%)`
          : `IZDAJ S POPUSTOM ${odluka.popust_postotak}% — ${iznos.toFixed(2)} EUR`}
      </Button>
      <Divider sx={{ my: 2 }} />
    </Box>
  );
}

// Ishod provjere i gumbi za prodaju — isti za očitanu karticu, ručni upis i
// MOSI, jer je odluka u svim slučajevima došla s istog mjesta.
function odlukaIGumbi(cijenaRed, sustav) {
  if (provjeraRadi) {
    return <Typography align="center" sx={{ fontWeight: 800, py: 2 }}>PROVJERA…</Typography>
  }
  if (!provjera) {
    return (
      <Typography align="center" color="text.secondary" sx={{ fontWeight: 700, py: 2 }}>
        Provjera prava još nije napravljena.
      </Typography>
    )
  }

  const smije = provjera.smije_se_prodati === true
  const redovna = redovnaCijenaRelacije()
  const iznos = cijenaPovlastene(provjera, cijenaRed)
  // Karta je besplatna kad je takav izracun, a ne kad SEOP javi pravo 100 %:
  // na liniji koja ne primjenjuje popust vrijedi cjenik i za takvo pravo.
  const gratis = iznos === 0

  return (
    <>
      <Typography align="center" sx={{ fontWeight: 800, py: 1 }} color={smije ? "success.main" : "error.main"}>
        {smije
          ? (provjera.primjeni_popust
              // Popust stvarno dolazi sa SEOP-a → pokaži postotak / besplatno.
              ? (gratis
                  ? 'KORISNIK IMA PRAVO NA BESPLATNU KARTU'
                  : `KORISNIK IMA PRAVO NA POPUST ${provjera.popust_postotak}%`)
              // Cijena ide iz cjenika — postotak/„besplatno" bi zbunjivao jer
              // popust nije od SEOP-a; samo potvrdi pravo na povlaštenu.
              : 'KORISNIK IMA PRAVO NA POVLAŠTENU KARTU')
          : 'NEMA PRAVA NA POVLAŠTENU KARTU NA OVOJ RELACIJI'}
      </Typography>
      {/* Poruka sa SEOP-a (npr. „…besplatno… 100%") pokazuje se samo kad SEOP
          stvarno daje popust, ili kad prava nema (razlog). Kad cijena ide iz
          cjenika, ta napomena samo zbunjuje. */}
      {(provjera.poruka || provjera.razlog) && (!smije || provjera.primjeni_popust) ? (
        <Typography align="center" color="text.secondary" sx={{ py: 0.5 }}>
          {provjera.razlog || provjera.poruka}
        </Typography>
      ) : null}

      {smije && provjera.pratnja_besplatno ? (
        <Button
          variant={pratnjaOdabrana ? "contained" : "outlined"}
          color="success"
          onClick={() => setPratnjaOdabrana((v) => !v)}
          sx={{ mt: 1, width: "100%" }}
        >
          {pratnjaOdabrana ? '☑' : '☐'}  DODAJ PRATNJU (BESPLATNO)
        </Button>
      ) : null}

      {smije ? (
        <>
        <Button
          disabled={!cijenaRed}
          variant="contained"
          color="success"
          onClick={() => {
            handleAddTickets({
              price: cijenaRed, rights: {}, type: sustav, free: gratis,
              iznos,
              povlastica: blokPovlastice({ ishod: provjera, cijenaRed }),
              pratnja: pratnjaOdabrana && provjera.pratnja_besplatno,
            })
          }}
          sx={{ height: 88, mt: 2, width: "100%", fontSize: "1.25rem" }}
        >
          {gratis ? 'BESPLATNA KARTA' : `IZNOS ZA PLAĆANJE ${iznos.toFixed(2)} EUR`}
        </Button>

        {/* Povratna otočna se bira u zasebnom modalu (kompaktno, s datumom). */}
        <Button
          variant="outlined"
          startIcon={<SwapHorizIcon />}
          onClick={() => {
            // Zapamti polaznu (isti oblik kao IZNOS gumb) — modal doda oba smjera.
            setPolaznaData({
              price: cijenaRed, rights: {}, type: sustav, free: gratis, iznos,
              povlastica: blokPovlastice({ ishod: provjera, cijenaRed }),
              pratnja: pratnjaOdabrana && provjera.pratnja_besplatno,
            });
            setPovratnaOtvoreno(true);
          }}
          sx={{ mt: 1, width: "100%" }}
        >
          PRODAJ POVRATNU
        </Button>
        </>
      ) : (
        // Prava nema ili se ne može provjeriti (kartica se ne da očitati, kvar
        // opreme, prekid veze…). Otočna se izdaje na povjerenje po povlaštenoj
        // (otočnoj) cijeni, ali djelatnik MORA odabrati razlog; SEOP dojava ide s
        // uvijekProdaj, a razlog+napomena (`greska` blok) idu u Kontrolu.
        <Box sx={{ mt: 2 }}>
          {/* Iznimka: veza je pala, ali je čip pročitan. Pravo tada znamo s
              kartice, a postotak iz lokalnog šifarnika — karta se izdaje s
              popustom, bez razloga, i nosi oznaku da je prodana bez provjere.
              Ovo je jedini slučaj u kojem blagajna sama određuje popust. */}
          {ponudiLokalniPopust(cijenaRed, sustav)}

          <Typography sx={{ fontWeight: 800, mb: 1 }}>
            Izdaj otočnu bez provjere — obavezan razlog:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            {RAZLOZI_GRESKE.map((r) => (
              <Button
                key={r.kljuc}
                size="small"
                variant={greskaRazlog === r.kljuc ? "contained" : "outlined"}
                color="error"
                onClick={() => setGreskaRazlog(r.kljuc)}
              >
                {r.naziv}
              </Button>
            ))}
          </Stack>
          <TextField
            fullWidth
            multiline
            minRows={1}
            size="small"
            label="Napomena (opcionalno)"
            value={greskaNapomena}
            onChange={(e) => setGreskaNapomena(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Button
            disabled={!cijenaRed || !greskaRazlog}
            variant="contained"
            color="warning"
            onClick={() => {
              handleAddTickets({
                price: cijenaRed, rights: {}, type: sustav, free: false,
                iznos: cijenaPovlastene(provjera, cijenaRed),
                povlastica: {
                  ...blokPovlastice({ ishod: provjera, cijenaRed, uvijekProdaj: true }),
                  greska: { razlog: greskaRazlog, napomena: greskaNapomena.trim() || null },
                },
              })
            }}
            sx={{ height: 88, width: "100%", fontSize: "1.25rem" }}
          >
            {cijenaRed
              ? `IZDAJ OTOČNU ${Number(cijenaRed.price).toFixed(2)} EUR`
              : 'NEMA OTOČNE CIJENE ZA RELACIJU'}
          </Button>
        </Box>
      )}
    </>
  )
}

function mosiCardDetails() {
  const isValidRights = cardData.F2.InvalidskaPrava.find((pravo => pravo.OznIP === 'MOB101'))
  return(
    <StatusPanel tone={isValidRights ? "success" : "error"} title="MOSI kartica">
      {isValidRights ? (
        <>
          <Stack direction="row" spacing={2}>
            <InfoCard title="Podaci o vlasniku">
              <DetailRow label="Ime i prezime" value={`${cardData.F2.Ime} ${cardData.F2.Prezime}`} />
              <DetailRow label="OIB" value={cardData.F2.OIB} />
              <DetailRow label="Adresa" value={cardData.F2.UlicaKBr} />
              <DetailRow label="Mjesto" value={cardData.F2.Mjesto} />
            </InfoCard>
            <InfoCard title="Podaci o kartici">
              <DetailRow label="Broj kartice" value={cardData.F2.SBr} />
              <DetailRow
                label="Vrijedi do"
                value={`${cardData.F2.DatIsteka.Day}/${cardData.F2.DatIsteka.Month}/${cardData.F2.DatIsteka.Year}`}
              />
            </InfoCard>
          </Stack>
          <Box sx={{ mt: 2 }}>
            <InfoCard title="Prava">
              {/* Popust i pravo pratnje na besplatnu kartu odreduju se po liniji
                  u portalu, pa odluka stize s posluzitelja kao i kod SEOP-a.
                  MOSI popust racuna se s REDOVNE cijene relacije (kako je
                  definiran na liniji), ne s otocne — MOSI-only linije nemaju
                  otocnu cijenu pa bi cijenaRed inace bio null i gumb onemogucen. */}
              {odlukaIGumbi(redovnaCijenaRelacije(), 'MOSI')}
            </InfoCard>
          </Box>
        </>
      ) : (
        <Typography align="center" sx={{ fontWeight: 800, py: 2 }}>
          NEODGOVARAJUĆA PRAVA
        </Typography>
      )}
    </StatusPanel>
  )
}

function noValidCard() {
  if (cardData?.cardFamily) {
    return (
      <StatusPanel tone="error">
        <Typography align="center" sx={{ fontWeight: 800, py: 1 }}>
          NEODGOVARAJUĆA KARTICA {cardData.cardFamily}
        </Typography>
      </StatusPanel>
    )
  }
  return (
    <StatusPanel tone="neutral">
      <Typography align="center" color="text.secondary" sx={{ fontWeight: 700, py: 1 }}>
        Postavi karticu na čitač pa pokreni skeniranje.
      </Typography>
    </StatusPanel>
  )
}

  const selectedRight = useMemo(
    () => virtualSeopCards.find((r) => r.code === selectedCode) || null,
    [selectedCode]
  );

  const isButtonEnabled = selectedCode.trim() !== "" && textValue.trim() !== "";


 

function virtualCardDetails() {
  const priceForSeopTicket = appData.searchData?.selectedTripPrices?.find((price) => price.is_island === true)
  return(
    <StatusPanel tone="neutral" title="Virtualna iskaznica">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: "background.paper" }}>
        <FormControl fullWidth>
          <InputLabel id="right-select-label">Broj virtualne kartice</InputLabel>
          <Select
            labelId="right-select-label"
            id="right-select"
            value={selectedCode}
            label="Broj virtualne kartice"
            onChange={(e) => setSelectedCode(e.target.value)}
          >
            {/* Bez praznog izbora — kartica je obavezna, a gumb je ionako
                onemogućen dok nije odabrana. */}
            {virtualSeopCards.map((r) => (
              <MenuItem key={r.id} value={r.code}>
                {r.code} {r.label ? `(${r.label})` : ""} — {r.description}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          sx={{ mt: 2 }}
          fullWidth
          label="Broj oznake odobrenja"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Upiši vrijednost..."
        />

        <Button
          variant="contained"
          color="success"
          onClick={()=>handleAddTickets({price:priceForSeopTicket, rights:{}, type:'VIRTUAL CARD', free:selectedRight?.free, card:selectedRight, odobrenje:textValue})}
          disabled={!isButtonEnabled}
          sx={{ width: '100%', height: 88, mt: 2, fontSize: "1.25rem" }}
        >
          {!selectedRight
            ? 'Odaberi virtualnu karticu'
            : selectedRight.free === true
              ? 'BESPLATNA KARTA'
              : `IZNOS ZA PLAĆANJE ${Number(priceForSeopTicket?.price ?? 0).toFixed(2)} EUR`}
        </Button>
      </Paper>
    </StatusPanel>
  )
}

    const style = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(900px, 94vw)",
      maxHeight: "92vh",
      overflowY: "auto",
      // Radna ploha kao na prodajnom ekranu; kartice unutar nje su bijele.
      bgcolor: "background.default",
      borderRadius: 3,
      boxShadow: 24,
      // Modal fokusira svoj okvir, pa Chrome oko njega crta focus ring.
      outline: "none",
      p: 3,
    };

  return (
    <>

        <Modal
          open={appData.modalsStates.showSubsidisedTickets}
          onClose={handleCloseSubsidizedModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 2 }}>
              <Typography id="modal-modal-title" variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                Povlaštene karte
              </Typography>
              <IconButton onClick={handleCloseSubsidizedModal}><CloseIcon /></IconButton>
            </Stack>
            {/* Razmak dolazi iz gap-a, ne iz mr/ml na svakom gumbu — prije su se
                zbrajali pa je razmak između njih bio dvostruk. */}
            <Stack direction="row" spacing={2} sx={{ pb: 2 }}>
              <Button
                variant="contained"
                sx={{ height: 88, width: "100%", fontSize: "1.1rem" }}
                onClick={readCard}
              >
                SKENIRAJ KARTICU
              </Button>
              <Button
                variant="contained"
                sx={{ height: 88, width: "100%", fontSize: "1.1rem" }}
                onClick={handleVirtualCard}
              >
                VIRTUALNA KARTICA
              </Button>
            </Stack>

            {/* Rucni upit — isti servis, samo bez citaca. */}
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, mb: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1.5 }}>
                Ručna provjera
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <FormControl sx={{ minWidth: 170 }}>
                  <InputLabel id="rucni-sustav">Sustav</InputLabel>
                  <Select
                    labelId="rucni-sustav"
                    label="Sustav"
                    value={rucniSustav}
                    onChange={(e) => { setRucniSustav(e.target.value); setProvjera(null); setGreskaRazlog(null); setGreskaNapomena(""); }}
                  >
                    <MenuItem value="SEOP">SEOP (otočna)</MenuItem>
                    <MenuItem value="MOSI">MOSI (invalidska)</MenuItem>
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel id="rucni-oblik">Upisuje se</InputLabel>
                  <Select
                    labelId="rucni-oblik"
                    label="Upisuje se"
                    value={rucniOblik}
                    onChange={(e) => { setRucniOblik(e.target.value); setRucniUnos(""); setProvjera(null); setGreskaRazlog(null); setGreskaNapomena(""); }}
                  >
                    <MenuItem value="card_no">Broj iskaznice</MenuItem>
                    <MenuItem value="oib">OIB putnika</MenuItem>
                    <MenuItem value="iks">Broj iksice</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label={rucniOblik === "oib" ? "OIB" : rucniOblik === "iks" ? "Broj iksice" : "Broj iskaznice"}
                  value={rucniUnos}
                  onChange={(e) => setRucniUnos(e.target.value.replace(/[^0-9A-Za-z]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") provjeriRucno(); }}
                />
                <Button
                  variant="contained"
                  sx={{ height: 56, minWidth: 140, flexShrink: 0 }}
                  onClick={provjeriRucno}
                  disabled={!rucniUnos.trim() || provjeraRadi}
                >
                  {provjeraRadi ? "PROVJERA…" : "PROVJERI"}
                </Button>
              </Stack>

              {/* Ručni upis završava na istom mjestu kao očitana kartica: ista
                  odluka, isti gumbi za prodaju. */}
              {!cardData && (provjera || provjeraRadi) ? (
                <Box sx={{ mt: 2 }}>
                  <StatusPanel
                    tone={provjera?.smije_se_prodati ? "success" : "error"}
                    title={provjera?.identifikator
                      ? `Provjera — ${provjera.identifikator.vrijednost}`
                      : "Provjera"}
                  >
                    {provjera?.pravo_na_pp || provjera?.otok ? (
                      <Typography align="center" sx={{ mb: 1 }}>
                        {provjera.pravo_na_pp ? `Pravo: ${provjera.pravo_na_pp}` : ""}
                        {provjera.pravo_opis ? ` (${provjera.pravo_opis})` : ""}
                        {provjera.otok ? `  ·  Otok: ${provjera.otok}` : ""}
                      </Typography>
                    ) : null}
                    {odlukaIGumbi(
                      rucniSustav === 'MOSI'
                        ? redovnaCijenaRelacije()
                        : appData.searchData?.selectedTripPrices?.find((price) => price.is_island === true),
                      rucniSustav
                    )}
                  </StatusPanel>
                </Box>
              ) : null}
            </Paper>

            {cardData?.cardFamily === 'SEOP_P' && !virtualCardData  ?
              seopCardDetails() :
              cardData?.cardFamily === 'MOSI' && !virtualCardData  ?
              mosiCardDetails() :
              virtualCardData ?
              virtualCardDetails() :
              noValidCard()
            }

          </Box>
        </Modal>
        <Modal
          open={appData.modalsStates.showSubsidisedTicketsData}
          onClose={handleCloseSubsidizedDataModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style}>
          <Button
              variant="contained"
              color="success"
              sx={{
                height: 150,
                mt: 4,
                mb: 2,
                width: "100%",
              }}
            >



            </Button>
          </Box>
        </Modal>

        <IslandReturnModal
          open={povratnaOtvoreno}
          onClose={() => { setPovratnaOtvoreno(false); setPolaznaData(null); }}
          polaznaData={polaznaData}
          relacija={appData.searchData?.selectedTrip}
          kartica={{
            vrsta: aktivniIdentifikator().vrsta || "card_no",
            vrijednost: aktivniIdentifikator().vrijednost,
            sustav: sustavKartice(),
            F2: cardData?.F2 || null,
          }}
          pocetniDatum={pocetniDatumPovratka()}
          provjeriRutu={provjeriKarticuNaRuti}
          cijenaPovlastene={cijenaPovlastene}
          blokPovlastice={blokPovlastice}
          onDodaj={handleAddTickets}
        />
    </>
  );
}
