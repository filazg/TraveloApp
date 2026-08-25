import React, { useMemo, useState } from "react";
import { alpha, Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem, Modal, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { allAppData, resetStateData, setStateData } from "../../store/appSlice";

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
                p: 2,
                bgcolor: (t) => alpha(t.palette[key].main, t.palette.mode === "dark" ? 0.18 : 0.1),
                borderColor: (t) => alpha(t.palette[key].main, 0.5),
            }}
        >
            {title ? (
                <Typography
                    align="center"
                    sx={{ fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", mb: 2 }}
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
        dispatch(setStateData({path:'modalsStates/showSubsidisedTickets', value: false}))
    };

    const handleCloseSubsidizedDataModal = () => {
        dispatch(setStateData({path:'modalsStates/showSubsidisedTicketsData', value: false}))
    };

     const handleVirtualCard = ()=>{
      setVirtualCardData(true)
    }

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

//DODAVANJE KARATA
const handleAddTickets = async(data) => {
  //await dispatch(setStateData({path:'status', value:'loading'}))  
  let cardDataToAdd = {}
   if(data.type === 'VIRTUAL CARD'){
      cardDataToAdd = data.card
      cardDataToAdd.odobrenje = data.odobrenje
   }else if(data.type === 'MOSI'){
      cardDataToAdd = cardData
   }else{
      cardDataToAdd = cardData
   }


  // Ruta se uzima iz selectedTrip (konkretna relacija koju je operater odabrao),
  // isto kao u redovnoj prodaji (TripPricesBar). selectedDeparture je samo prvi
  // segment polaska i nema polje `sales_routes_uuid` — tablica sales_routes ima
  // `uuid`, pa je sales_route_uuid ispadao undefined i bulkCreate stavki računa
  // je pucao na notNull ("Validation error"), a karte se nisu ni kreirale ni
  // isprintale. Modal je ionako dostupan samo kad selectedTrip postoji (FilterBar).
  const salesRoute = appData.searchData.selectedTrip
  const newTicket = {
    id: 1,
    sales_route_uuid: salesRoute.uuid,
    line_code: salesRoute.line_code,
    line_name: salesRoute.line_name,
    departure: salesRoute.departure,
    departure_harbor_id: salesRoute.departure_harbor_id,
    departure_harbor_name: salesRoute.departure_harbor_name,
    arrival: salesRoute.arrival,
    arrival_harbor_id: salesRoute.arrival_harbor_id,
    arrival_harbor_name: salesRoute.arrival_harbor_name,
    ticket_type_name: data?.type  ? data.type :data.price.ticket_type_name,
    ticket_type_id: data?.type  ? data.type :data.price.ticket_type_id,
    ticket_type_uuid: data?.type  ? data.type :data.price.ticket_type_uuid,
    ticket_group_uuid: uuid(),
    single_price: data.free ? 0 : data.price.price,
    total_price: data.free ? 0 : data.price.price ,
    total_vat_base: data.free ? 0 : data.price.vat_base ,
    total_vat: data.free ? 0 : data.price.vat_amount ,
    total_harbor_tax: data.free ? 0 : data.price.port_tax ,
    quantity: 1,
    tickets: [{
      uuid: uuid(),
      code: uuid(),
    }],
    card_data:cardDataToAdd
  }
  console.log('NEW TICEKT', newTicket)
  let ticketsToAdd = []
  ticketsToAdd = [...ticketsToAdd, newTicket];
  dispatch(setStateData({path:'saleData/addedTickets' ,value: ticketsToAdd }));
  handleCloseSubsidizedModal()
  dispatch(resetStateData({path:'searchData/selectedTrip'}))
    dispatch(resetStateData({path:'searchData/selectedTripPrices'}))
    dispatch(resetStateData({path:'searchData/ticketsCounter'}))

    //await dispatch(setStateData({path:'status', value:'ready'}))
  };






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



function seopCardDetails() {
  let message = ''
  let haveValidRight = false
  let freeTicket = false
  const rightOnCard = seopRights.find((right) => right.code === cardData.F2.BasicRight)
  const isValidIsland = appData.searchData?.lineHarbors.find((harbor) =>   cardData.F2.IslandName === harbor.seop_harbor || cardData.F2.IslandName === 'Svi otoci')
  const priceForSeopTicket = appData.searchData?.selectedTripPrices?.find((price) => price.is_island === true)
  console.log('priceForSeopTicket',priceForSeopTicket)
  return(
    <StatusPanel tone={isValidIsland ? "success" : "error"} title="Otočna kartica SEOP_P">
      <Stack direction="row" spacing={2}>
        <InfoCard title="Podaci o vlasniku">
          <DetailRow label="Ime i prezime" value={`${cardData.F2.FirstName} ${cardData.F2.Surname}`} />
          <DetailRow label="OIB" value={cardData.F2.OIB} />
          <DetailRow label="Adresa" value={cardData.F2.PermResAddress} />
          <DetailRow label="Mjesto" value={cardData.F2.PermResMuniciname} />
        </InfoCard>
        <InfoCard title="Podaci o pravima">
          <DetailRow label="Broj kartice" value={cardData.F2.CardNumber} />
          <DetailRow
            label="Vrijedi do"
            value={`${cardData.F2.ExpirationDate.Day}/${cardData.F2.ExpirationDate.Month}/${cardData.F2.ExpirationDate.Year}`}
          />
          <DetailRow label="Osnovno pravo" value={cardData.F2.BasicRight} />
          <DetailRow label="Vrijedi za otok" value={cardData.F2.IslandName} />
        </InfoCard>
      </Stack>

      <Box sx={{ mt: 2 }}>
        <InfoCard title="Prava">
          <Typography align="center" sx={{ fontWeight: 600, py: 1 }}>
            {rightOnCard
              ? (isValidIsland ? rightOnCard.description : 'Pravo na kartici nije važeće za odabranu relaciju.')
              : 'Nema odgovarajućeg prava na kartici.'}
          </Typography>
          {isValidIsland ? (
            <>
              <Typography
                align="center"
                color="success.main"
                sx={{ fontWeight: 800, py: 1 }}
              >
                {rightOnCard?.freeTicket ? 'KORISNIK IMA PRAVO NA BESPLATNU KARTU' : 'KORISNIK IMA PRAVO NA KARTU SA POPUSTOM'}
              </Typography>
              <Button
                disabled={!priceForSeopTicket && !rightOnCard?.freeTicket}
                variant="contained"
                color="success"
                onClick={()=>handleAddTickets({price:priceForSeopTicket, rights:rightOnCard, type:'SEOP', free:rightOnCard.freeTicket})}
                sx={{ height: 88, mt: 2, width: "100%", fontSize: "1.25rem" }}
              >
                {rightOnCard?.freeTicket
                  ? 'BESPLATNA KARTA'
                  : `IZNOS ZA PLAĆANJE ${priceForSeopTicket?.price.toFixed(2)} EUR`}
              </Button>
            </>
          ) : null}
        </InfoCard>
      </Box>
    </StatusPanel>
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
              <Typography align="center" color="success.main" sx={{ fontWeight: 800, py: 1 }}>
                KORISNIK IMA PRAVO NA BESPLATNU KARTU
              </Typography>
              <Button
                variant="contained"
                color="success"
                onClick={()=>handleAddTickets({price:{}, rights:{}, type:'MOSI', free:true})}
                sx={{ height: 88, mt: 2, width: "100%", fontSize: "1.25rem" }}
              >
                BESPLATNA KARTA
              </Button>
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
    </>
  );
}
