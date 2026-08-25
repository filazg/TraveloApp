
import { Box, Button, Chip, Grid, Modal, Paper, Stack, TextField, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, resetStateData, setStateData } from "../../store/appSlice";
import ShiftsView from "./ShiftView";
import { useEffect } from "react";
import InvoicesListModal from "./InvoicesListModal";
import TicketsListModal from "./TicketsListModal";

export default function BottomBar() {
  const dispatch = useDispatch();
  const appData = useSelector(allAppData);
  const buyer = appData.saleData?.selectedBuyer;

  const handleLogout = async () => {
    dispatch(setStateData({path:'modalsStates/shohConfirmLogout', value: true}))
  };

  const handleShiftModalOpen = () =>{
    dispatch(setStateData({path:'modalsStates/showShiftView', value:true}))
  }

  const getShiftData = async () => {
    // Smjena pripada operateru — desk može imati više usera paralelno, pa
    // svaki vidi samo SVOJ obračun rada/promet.
    const username = appData.logedUser?.user_username;
    if (!username) return;
    const getshiftsData = await window.api.app.getShiftsDataIpc(username);
    await dispatch(setStateData({ path: "shiftsData/shifts", value: getshiftsData.data.shifts || [] }));
   };

  useEffect(()=>{
    getShiftData()
  },[appData.logedUser?.user_username])

  useEffect(() => {
    if(appData.shiftsData.shifts?.length){
      const checkOpenShift = appData.shiftsData.shifts?.find(
        (shift) =>
          shift.operater_username === appData.logedUser?.user_username &&
        shift.shift_open === true
      );
      if(checkOpenShift){
        dispatch(setStateData({path:'canOpenNewShift', value: false}))
      }else{
        dispatch(setStateData({path:'canOpenNewShift', value: true}))
      }
    }else{
        dispatch(setStateData({path:'canOpenNewShift', value: true}))
    }
  }, [appData.shiftsData.shifts]);

   const getInvoicesData = async () => {
     const getInvoiceData = await window.api.app.getInvoicesIPC()
     console.log('GET INVOICES ', getInvoiceData)
     await dispatch(setStateData({path:'workingData/invoices', value: getInvoiceData.data.invoices }))
    }
    
    
    const handleInvoiceModalOpen = async() => {
      //await dispatch(setStateData({path:'status', value:'loading'}))
      // Povuci najnoviji F2 (YesCor) status iz backenda za R1 račune u obradi,
      // pa tek onda učitaj listu — kolona F2 status u listi prikazuje to.
      try { await window.api.app.refreshPendingF2StatusesIPC() } catch (e) {}
      await getInvoicesData()
      dispatch(setStateData({path:'modalsStates/showInvoiceView', value: true}))
      //await dispatch(setStateData({path:'status', value:'ready'}))
    };
    
    const getTicketsData = async () => {
      const ticketsData = await window.api.app.getTicketsIPC()
      console.log(ticketsData)
      await dispatch(setStateData({path:'workingData/tickets', value: ticketsData.data.tickets }))
     }

  const handleTicketsModalOpen = async() => {
    await getTicketsData()
    dispatch(setStateData({path:'modalsStates/showTicketsModal', value: true}))
  };

  function subtotal(tickets) {
    if(!tickets || !tickets.length){
      return 0;
    }
    return tickets
      .map(({ total_price }) => total_price)
      .reduce((sum, i) => sum + i, 0);
  }

  const invoiceSubtotal = subtotal(appData.saleData.addedTickets);

  const updateBooking = async () => {
    const data = appData.searchData.selectedDeparture
    const dataToSearch = {
      timetable_uuid: data.timetable_uuid,
      sequence: data.sequence,
    };
    const bookingData = await window.api.app.getOnlineBookingDataIPC(dataToSearch);
    await dispatch(setStateData({path:'searchData/bookingData', value: bookingData.data}));
 };

   const handleConfirm = async () => {
    await dispatch(setStateData({path:'status', value:'loading'}))
    await dispatch(setStateData({path:'loadingText', value:'Priprema podataka...'}))
     const buyerData = appData.saleData?.selectedBuyer
    let payment = {};
    let isOk = true;
    let message = '';
    let paymentResponse = {};
    const pay= true

    // Koji uređaj naplaćuje određuje `card_provider` sa sredstva plaćanja
    // (postavlja se u portalu). Blagajna vodi samo OTP_POS; MONRI je web naplata,
    // SEVENPAY još nije implementiran, a kartica bez providera znači vanjski
    // terminal — račun se tada izda bez pokretanja transakcije.
    //
    // Sredstvo plaćanja je redak iz payment_methods, pa se polje zove
    // `is_card_payment`. Prije se provjeravalo `payment_method_is_card_payment`,
    // koje na tom objektu ne postoji — uvjet je uvijek bio netočan, POS se nikad
    // nije pozvao i kartična prodaja je tiho prolazila kao obična.
    const selectedPayment = appData.saleData.selectedPaymentMethod || {}
    const cardProvider = selectedPayment.is_card_payment ? (selectedPayment.card_provider || '') : ''

    if (cardProvider && cardProvider !== 'OTP_POS') {
      await dispatch(setStateData({path:'alertData', value:{
        message: `Sredstvo plaćanja "${selectedPayment.name}" naplaćuje ${cardProvider}, što blagajna ne podržava.`,
        severity: 'error'
      }}))
      await dispatch(setStateData({path:'status', value:'ready'}))
      return
    }

    if(cardProvider === 'OTP_POS'){
      await dispatch(setStateData({path:'loadingText', value:'Kartično plačanje...'}))
      payment = await window.api.app.cardPaymentIPC({
        comPort: appData.basicData.settings.pos_port,
        transactionType: "01",// polje 5 (2) Sale OVO
        // Isto kao kod storna: ispisuje li slip POS ili aplikacija određuje postavka.
        printerFlag: appData.basicData.settings.pos_print_on_app ? "0" : "1",
        cashierId: "01",      // polje 7 (2)
        transactionNumber: "",// polje 8 (0 or 6) - prazno
        amount1: invoiceSubtotal.toFixed(2),      // polje 10 (Transaction Amount 1) - u najmanjim jedinicama (100 -> 1.00 HRK ako exponent +2) OVO 
        amount2: "",          // polje 12 OVO
      
    });

    console.log('SoftPOS odgovor:', payment);
      const data = payment.data || {};
      const flag = data.transactionFlag || '';
      const approvedFlags = ["01", "02", "99"];
    
    

      if (!payment.ok) {
          message = payment.error || 'Došlo je do greške pri kartičnom plaćanju.';
          isOk = false;
          //await dispatch(setLoading({path: 'isLoading', value: false}));
        }else if (data.displayMessage === "LIMIT PREKORACEN") {
          console.log('SoftPOS plaćanje nije uspješno - prekoračen limit');

          //await dispatch(
          //  setSalesStatesData({ path: 'paymentModal', values: true })
          //);

          isOk = false;
          
        }else if (data.displayMessage === "") {
          console.log('SoftPOS plaćanje nije uspješno');

          //await dispatch(
          //  setSalesStatesData({ path: 'paymentModal', values: true })
          //);

          isOk = false;
          //await dispatch(setLoading({path: 'isLoading', value: false}));
          
        }else if (!approvedFlags.includes(flag)) {
          message = `Kartično plaćanje nije odobreno. Kod: ${flag} - ${data.displayMessage || 'Nepoznat razlog'}`;
          isOk = false;
          //await dispatch(setLoading({path: 'isLoading', value: false}));
        }else if(approvedFlags.includes(flag)){
          console.log('SoftPOS plaćanje uspješno', data);
          paymentResponse = data;
        }

    }

    if(!isOk){
      console.log('PAYMENT NOT OK')
      await dispatch(setStateData({path:'alertData', value:{message:'Neuspješna naplata',severity:'error'}})) 
  
    }else{
      await dispatch(setStateData({path:'loadingText', value:'Izdavanje računa...'}))
      
      const dataToSend = {
        user: appData.logedUser,
        buyer: buyerData,
        tickets: appData.saleData.addedTickets,
        items:appData.saleData.addedTicketsGroups,
        payment: appData.saleData?.selectedPaymentMethod,
        paymentData: paymentResponse
      };
      const invoiceResult = await window.api.app.createInvoiceIPC(dataToSend);
      await dispatch(resetStateData({path:'saleData'}))
      await updateBooking()
      //const getInvoiceData = await window.api.e_getInvoices()
      //console.log(getInvoiceData)
      //dispatch(setDocumentsData({path:'invoices', value: getInvoiceData }))
      //dispatch(resetSelectedTicketsData())
      //const getTicketsData = await window.api.e_getTickets()
      //console.log(getTicketsData)
      //dispatch(setDocumentsData({path:'tickets', value: getTicketsData }))
      //dispatch(resetSettingsData({ path: 'selectedBuyer' }))    
      // Račun je izdan i kad printer zakaže; karta koja nije izašla mora se vidjeti
      // odmah, jer je putnik bez nje na ukrcaju.
      const printStatus = invoiceResult?.data?.print
      if (printStatus && printStatus.tickets === false) {
        await dispatch(setStateData({path:'alertData', value:{
          message:'Račun je izdan, ali karte nisu ispisane — ispišite kopiju karte iz dokumenata.',
          severity:'warning',
        }}))
      } else if (buyerData?.f2_required) {
        // Bez ove poruke izgleda kao da je ispis računa zakazao — F2 se namjerno
        // ne printa, kupcu ide kao e-račun.
        await dispatch(setStateData({path:'alertData', value:{
          message:'F2 račun je izdan — kupcu ide kao e-račun, ispisane su samo karte.',
          severity:'success',
        }}))
      } else {
        await dispatch(setStateData({path:'alertData', value:{message:'Račun je uredno izdan',severity:'success'}}))
      }
    }   
    await dispatch(setStateData({path:'status', value:'ready'}))
  };

  return (
    <>
      <ShiftsView
        aria-labelledby="parent-modal-title"
        aria-describedby="parent-modal-description"
      />
      <InvoicesListModal
        aria-labelledby="parent-modal-title"
        aria-describedby="parent-modal-description"
      />
      <TicketsListModal
        aria-labelledby="parent-modal-title"
        aria-describedby="parent-modal-description"
      />
      <Grid
        sx={{
          width: 1600,
        }}
      >
        <Grid
          item
          sx={{
            p: 1,
            fontSize: "0,875rem",
            fontWeight: "700",
          }}
        >
          <Grid
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 1,
              gridTemplateRows: "auto",
              gridTemplateAreas: `"one two tree four four four seven seven"
                        "one two tree2 four four four seven seven"`,
            }}
          >
            {/* Isti font na svim gumbima donje trake, kao u stupcu Plaćanje.
                Riječ "PREGLED" je maknuta — gumb ionako otvara pregled, a bez
                nje natpisi stanu u jedan red i lakše se čitaju. */}
            <Button
              variant="contained"
              color="error"
              sx={{
                gridArea: "one",
                fontSize: "1.1rem",
              }}
              onClick={handleLogout}
            >
              ODJAVA
            </Button>
            <Button
              variant="contained"
              sx={{
                gridArea: "two",
                fontSize: "1.1rem",
              }}
              onClick={handleShiftModalOpen}
            >
              SMJENE
            </Button>
            <Button
              variant="contained"
              sx={{
                gridArea: "tree",
                fontSize: "1.1rem",
              }}
              onClick={handleInvoiceModalOpen}
            >
              RAČUNI
            </Button>
            <Button
              variant="contained"
              sx={{
                gridArea: "tree2",
                fontSize: "1.1rem",
              }}
              onClick={handleTicketsModalOpen}
            >
              KARTE
            </Button>
            {/* Prazan prostor između gumba i IZDAJ — dovoljno širok da stane
                cijeli naziv kupca, što na gumbu u stupcu Plaćanje nije stalo.
                Bez odabranog kupca ostaje prazan: većina prodaje je B2C i
                natpis "nema kupca" bi visio na ekranu cijelu smjenu. */}
            <Box sx={{ gridArea: "four", display: "flex", alignItems: "center", minWidth: 0 }}>
              {buyer?.buyer_vat_id ? (
                <Paper variant="accent" sx={{ px: 2, py: 1, width: "100%", minWidth: 0 }}>
                  <Typography
                    noWrap
                    sx={{ fontWeight: 800, lineHeight: 1.3 }}
                    title={buyer.buyer_company_name || buyer.buyer_name}
                  >
                    {buyer.buyer_company_name || buyer.buyer_name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      OIB: {buyer.buyer_vat_id}
                    </Typography>
                    <Chip
                      size="small"
                      label={buyer.f2_required ? "F2 — e-račun" : "R1"}
                      color={buyer.f2_required ? "warning" : "success"}
                      sx={{ fontWeight: 700 }}
                    />
                  </Stack>
                </Paper>
              ) : null}
            </Box>
            <Button
              variant="contained"
              disabled={!appData.saleData?.addedTickets?.length || !appData.saleData?.selectedPaymentMethod?.uuid || appData.canOpenNewShift}
              sx={{
                // Završna radnja prodaje — najveći natpis na ekranu, uz iznos
                // koji blagajnik očitava naglas.
                gridArea: "seven",
                fontSize: "1.6rem",
              }}
              onClick={handleConfirm}
            >
              IZDAJ / {invoiceSubtotal.toFixed(2)} EUR
            </Button>
           
          </Grid>
        </Grid>
      </Grid>
    </>
  );
}
