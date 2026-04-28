import React, { useMemo, useState } from "react";
import { Box, Button, FormControl, Grid, InputLabel, MenuItem, Modal, Select, Stack, TextField, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { allAppData, resetStateData, setStateData } from "../../store/appSlice";

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


  const newTicket = {
    id: 1,
    sales_route_uuid:appData.searchData.selectedDeparture.sales_routes_uuid,
    line_code: appData.searchData.selectedDeparture.line_code,
    line_name: appData.searchData.selectedDeparture.line_name,
    departure: appData.searchData.selectedDeparture.departure,
    departure_harbor_id:appData.searchData.selectedDeparture.departure_harbor_id,
    departure_harbor_name:appData.searchData.selectedDeparture.departure_harbor_name,
    arrival: appData.searchData.selectedDeparture.arrival,
    arrival_harbor_id: appData.searchData.selectedDeparture.arrival_harbor_id,
    arrival_harbor_name:appData.searchData.selectedDeparture.arrival_harbor_name,
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
  <>
        <Box
            sx={{
            width: "100%",
            borderRadius: 2,
            backgroundColor: isValidIsland ? "#ffeb3b" : "#f28b82",
          }}
        >
        <Typography sx={{pt:2}} align="center" fontWeight="bold" gutterBottom>
          Otočna kartica SEOP_P
        </Typography>

         
      <Stack
          direction="row"
          sx={{ pt: 2, pb: 2 }}
        >
         <Box
            sx={{
               width: "50%",
                ml:2,
                p:2,
                backgroundColor: "white",
                borderRadius: 2,
            }}
            >
            {/* Naslov */}
            <Typography align="center" fontWeight="bold" gutterBottom>
              PODACI O VLASNIKU
            </Typography>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Ime i prezime:</Typography>
              <Typography>{cardData.F2.FirstName} {cardData.F2.Surname}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>OIB:</Typography>
              <Typography>{cardData.F2.OIB}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Adresa:</Typography>
              <Typography>{cardData.F2.PermResAddress}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Mjesto:</Typography>
              <Typography> {cardData.F2.PermResMuniciname}</Typography>
            </Stack>
          </Box>
          <Box sx={{ 
              width: "50%",
              ml: 4, 
              mr: 2,
              p:2,
              backgroundColor: "white",
              borderRadius: 2,
            }}>
            {/* Naslov */}
            <Typography align="center" fontWeight="bold" gutterBottom>
              PODACI O PRAVIMA
            </Typography>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Broj kartice:</Typography>
              <Typography>{cardData.F2.CardNumber}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Vrijedi do:</Typography>
              <Typography>
                {cardData.F2.ExpirationDate.Day}/
                {cardData.F2.ExpirationDate.Month}/
                {cardData.F2.ExpirationDate.Year}
                </Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Osnovno pravo:</Typography>
              <Typography> {cardData.F2.BasicRight}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Vrijedi za otok:</Typography>
              <Typography> {cardData.F2.IslandName}</Typography>
            </Stack>
          </Box>
      </Stack>
      <Stack
        sx={{pb: 2 }}
      >

       <Box
            sx={{ 
              width: "96%", 
              ml:2,
              backgroundColor: "white",
              borderRadius: 2,
            }}
            >
          <Typography sx={{pt:2}} align="center" fontWeight="bold" gutterBottom>
            PRAVA
          </Typography>
          <Typography sx={{pt:2, pl:2, pr:2, pb:2}} align="center" fontWeight="bold" >
            {rightOnCard ? 
            isValidIsland ?
              rightOnCard.description 
              : 'Pravo na kartici nije važeće za odabranu relaciju.'
            
            : 'Nema odgovarajućeg prava na kartici.'}
          </Typography>
          {isValidIsland ?
          <>
          <Typography sx={{pt:2, pl:2, pr:2, pb:2}} align="center" fontWeight="bold" >            
            {rightOnCard?.freeTicket && isValidIsland ? "KORISNIK IMA PRAVO NA BESPALATNU KARTU" : 'KORISNIK IMA PRAVO NA KARTU SA POPUSTOM'}
          </Typography>
          
           <Button
                disabled={!priceForSeopTicket && !rightOnCard?.freeTicket}
              variant="contained"
              color="success"
              onClick={()=>handleAddTickets({price:priceForSeopTicket, rights:rightOnCard, type:'SEOP', free:rightOnCard.freeTicket})}
              sx={{
                height: 100,
                mt: 4,
                width: "100%",
              }}
            >
              {rightOnCard?.freeTicket ? 
              <Typography>
                  BESPLATNA KARTA
              </Typography>
              :              
              <Typography>
                  IZNOS ZA PLAĆANJE {priceForSeopTicket?.price.toFixed(2)} EUR
              </Typography>
  }
            </Button>
            </>
          :
          ''
        }
        </Box>

      </Stack>
      </Box>
    </>
  )
}

function mosiCardDetails() {
  const isValidRights = cardData.F2.InvalidskaPrava.find((pravo => pravo.OznIP === 'MOB101'))
  return(
    <>
        <Box
            sx={{
            width: "100%",
            borderRadius: 2,
            backgroundColor: isValidRights ? "lightgray" : "#f28b82",
          }}
        >
        <Typography sx={{pt:2}} align="center" fontWeight="bold" gutterBottom>
          MOSI kartica
        </Typography>

      {isValidRights ? 
      
     <>
      <Stack
        direction="row"
        sx={{ pt: 2, pb: 2 }}
        >
         <Box
            sx={{
              width: "50%",
              ml:2,
              p:2,
              backgroundColor: "white",
              borderRadius: 2,
            }}
            >
            {/* Naslov */}
            <Typography align="center" fontWeight="bold" gutterBottom>
              PODACI O VLASNIKU
            </Typography>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Ime i prezime:</Typography>
              <Typography>{cardData.F2.Ime} {cardData.F2.Prezime}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>OIB:</Typography>
              <Typography> {cardData.F2.OIB}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Adresa:</Typography>
              <Typography> {cardData.F2.UlicaKBr}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Mjesto:</Typography>
              <Typography>{cardData.F2.Mjesto}</Typography>
            </Stack>
          </Box>
          <Box sx={{
              width: "50%",
              ml: 4, 
              mr: 2,
              p:2,
              backgroundColor: "white",
              borderRadius: 2,
              }}
            >
            {/* Naslov */}
            <Typography align="center" fontWeight="bold" gutterBottom>
              PODACI O KARTICI
            </Typography>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Broj kartice:</Typography>
              <Typography> {cardData.F2.SBr}</Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between'>
              <Typography>Vrijedi do:</Typography>
              <Typography>
                {cardData.F2.DatIsteka.Day}/
                {cardData.F2.DatIsteka.Month}/
                {cardData.F2.DatIsteka.Year}
              </Typography>
            </Stack>
          </Box>
      </Stack>
      <Stack
        sx={{pb: 2 }}
      >

       <Box
            sx={{ 
              width: "96%", 
              ml:2,
              backgroundColor: "white",
              borderRadius: 2,
            }}
            >
          
          <>
          <Typography sx={{pt:2, pl:2, pr:2, pb:2}} align="center" fontWeight="bold" >            
            "KORISNIK IMA PRAVO NA BESPALATNU KARTU"
          </Typography>
          
           <Button
              variant="contained"
              color="success"
              onClick={()=>handleAddTickets({price:{}, rights:{}, type:'MOSI', free:true})}
              sx={{
                height: 100,
                mt: 4,
                width: "100%",
              }}
            >
              <Typography>
                  BESPLATNA KARTA
              </Typography>
             
            </Button>
            </>
         
        </Box>

      </Stack>
      </>
       :
      <Stack
        direction="row"
        sx={{ pt: 2, pb: 2 }}
        >
           <Box
            sx={{
              width: "100%",
              ml:2,
              p:2,
              borderRadius: 2,
            }}
            >
               <Typography sx={{pt:2}} align="center" fontWeight="bold" gutterBottom>
                NEODGOVARAJUĆA PRAVA
              </Typography>
            </Box>
        </Stack>
      }
       </Box>
    </>
  )
}

function noValidCard() {
  return(
    <>
        
          {cardData?.cardFamily ?
           <Box
            sx={{
            width: "100%",
            borderRadius: 2,
            backgroundColor: "#f28b82",
            pb:2,
          }}
        >
        <Typography sx={{pt:2}} align="center" fontWeight="bold" gutterBottom>
          NEODGOVARAJUĆA KARTICA {cardData.cardFamily}
        </Typography>
        </Box>
          :
          <Box
            sx={{
            width: "100%",
            borderRadius: 2,
            pb:2,
          }}
        >
        <Typography sx={{pt:2}} align="center" fontWeight="bold" gutterBottom>
          POSTAVI KARTICU NA ČITAČ i POKRENI SKENIRANJE KARTICE
        </Typography>
        </Box>
          }
      </>
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
    <>
      <Box
            sx={{
            width: "100%",
            borderRadius: 2,
            backgroundColor: "lightgrey",
          }}
        >
           <Stack
        direction="row"
        sx={{ pt: 2, pb: 2 }}
        >
           <Box
            sx={{ 
              width: "96%", 
              m:2,
              borderRadius: 2,
            }}
            >

          
          <FormControl fullWidth>
          <InputLabel id="right-select-label">Broj virtualne kartice</InputLabel>
          <Select
            labelId="right-select-label"
            id="right-select"
            value={selectedCode}
            label="Pravo"
            onChange={(e) => setSelectedCode(e.target.value)}
          >
            <MenuItem value="">
              <em>-- odaberi virtualnu karticu --</em>
            </MenuItem>

            {virtualSeopCards.map((r) => (
              <MenuItem key={r.id} value={r.code}>
                {r.code} {r.label ? `(${r.label})` : ""} — {r.description}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
        sx={{
          mt:2,
        }}
         
          fullWidth
          label="Broj oznake odobrenja"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Upiši vrijednost..."
        />

        <Button
          variant="contained"
          onClick={()=>handleAddTickets({price:priceForSeopTicket, rights:{}, type:'VIRTUAL CARD', free:selectedRight?.free, card:selectedRight, odobrenje:textValue})}
          disabled={!isButtonEnabled}
          sx={{
            width:'100%',
            height:100,
            mt:2
          }}
        >
          {!selectedRight ? (
            <Typography>Odaberi virtualnu karticu</Typography>
          ) : selectedRight.free === true ? (
            <Typography>BESPLATNA KARTA</Typography>
          ) : (
            <Typography>
              IZNOS ZA PLAĆANJE {Number(priceForSeopTicket?.price ?? 0).toFixed(2)} EUR
            </Typography>
          )}
        </Button>
        </Box>
        </Stack>
        </Box>
       
    </>
  )
}

    const style = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 800,
      bgcolor: "background.paper",
      border: "2px solid #000",
      boxShadow: 24,
      p: 4,
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
            <Typography
              id="modal-modal-title"
              variant="h6"
              component="h2"
              align="center"
            >
              Povlaštene karte
            </Typography>
            <Stack
              direction="row">
            <Button
              variant="contained"
              sx={{
                height: 100,
                mt: 2,
                mr: 2,
                mb: 2,
                width: "100%",
              }}
              onClick={readCard}
            >
              SCAN KARTICE
            </Button>
            <Button
              variant="contained"
              sx={{
                height: 100,
                mt: 2,
                ml: 2,
                mb: 2,
                width: "100%",
              }}
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
