import { Box, Button, Fab, Modal, Stack, Typography } from "@mui/material";

import PrintIcon from '@mui/icons-material/Print';
import CancelIcon from '@mui/icons-material/Cancel';
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { useCallback, useRef, useState } from "react";
import { useStornoPercentagePicker } from "./StornoPercentagePicker";

export default function TicketsActions ({ params, rowId}) {
    const dispatch = useDispatch()
    const appData = useSelector(allAppData);
    const [cancelPaymentMethod, setCancelPaymentMethod] = useState()
    const [cancelPaymentModal, setCancelPaymentModal] = useState(false)

    const [confirmed, setConfirmed] = useState(false);

    // Postotak povrata — zajednička komponenta, ista i za storno računa.
    const stornoPicker = useStornoPercentagePicker()

    // Stornirana karta se ni ne ispisuje ni ne stornira ponovno. Gumbi se gase
    // umjesto da se klik dočeka porukom — blagajnik odmah vidi da ne ide.
    const jeStornirana = params.row?.ticket_status === 'CANCELED'
        || !!params.row?.ticket_is_canceled
        || !!params.row?.ticket_deactivate


    const handleCloseCancelModal = async()=>{
        setCancelPaymentModal(false)
    }

    const handlePrintTicket = async()=>{
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Ispis kopije karte...'}))
        await window.api.app.printTicketCopyIPC(params.row.ticket_code)
        await dispatch(setStateData({path:'status', value:'ready'}))
    }

    const resolverRef = useRef(null);

    const askForConfirmation = useCallback(() => {
        setCancelPaymentModal(true);

        return new Promise((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const closeWithAnswer = (answer) => {
        console.log('ANSSWER ', answer)

        setCancelPaymentModal(false);

        // resolve promise
        if (resolverRef.current) {
        resolverRef.current(answer);
        resolverRef.current = null;
        }
    };
    
    const handleCancelTicket = async()=>{
        // Postotak se bira prije svega ostalog — ako blagajnik odustane, ništa se
        // ne dira. Bez definiranog šifarnika storno nije moguć, jednako kao na
        // mobilnoj: slobodan upis postotka više ne postoji.
        if (!stornoPicker.percentages.length) {
            await dispatch(setStateData({path:'alertData', value:{
                message:'Nema definiranih postotaka storniranja. Dodajte ih u portalu (Administracija → Postotci storniranja) i pokrenite sinkronizaciju.',
                severity:'error'
            }}))
            return
        }
        const pctAnswer = await stornoPicker.ask({
            label: `Karta ${params.row?.ticket_code || ''}`,
            amount: Number(params.row?.ticket_single_price || 0),
        })
        if (!pctAnswer?.status) return
        const stornoPct = pctAnswer.value

        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Priprema podataka...'}))
        let payment = {};
        let isOk = true;
        let message = '';
        let severity = 'success'
        let paymentResponse = {};
        let paymentMethod = {}
        const pay= true
        const invoiceData = await window.api.app.getInvoiceIPC(params.row.order_number)
        console.log('INOVOICE DATA:', invoiceData.data.invoice)
        if(invoiceData.data.invoice?.invoice_status === 'canceled-orginal' || invoiceData.data.invoice?.invoice_status === 'canceled'){
            await dispatch(setStateData({path:'alertData', value:{message:'Kartu nije moguće stornirati',severity:'error'}}))
        }else if(invoiceData.data.invoice?.invoice_status === 'canceled-partial'){
            if(params.row.ticket_status === 'CANCELED' || params.row.ticket_status === 'VALIDATE' ){
                await dispatch(setStateData({path:'alertData', value:{message:'Kartu nije moguće stornirati AA',severity:'error'}}))
            }else{
               if (!cancelPaymentMethod) {
                    const answer = await askForConfirmation(); // <— ovdje "stane" dok user ne klikne
                    if (!answer.status) {
                        console.log('odustao je faca')
                        isOk = false
                    }
                    setCancelPaymentMethod(answer.data);
                    message = "Račun je uspiješno storniran";
                    severity = 'success'
                    paymentMethod= answer.data
                    console.log("✅ User potvrdio, state postavljen u true.");
                }
            }
        }else{
            if(params.row.ticket_status === 'CANCELED' || params.row.ticket_status === 'VALIDATE' ){
                await dispatch(setStateData({path:'alertData', value:{message:'Kartu nije moguće stornirati CCC',severity:'error'}}))
            }else{
                if(invoiceData.data.invoice.invoice_payment_method_fiscal_mark === 'K'){
                    console.log('IFFFFF JEEEEE')
                    await dispatch(setStateData({path:'loadingText', value:'Kartično plačanje...'}))
                    payment = await window.api.app.cardPaymentIPC({
                        comPort: appData.basicData.settings.pos_port,
                        transactionType: "05",// polje 5 (2) Sale OVO 
                        printerFlag: appData.basicData.settings.pos_print_on_app,     // polje 6 (1)
                        cashierId: "01",      // polje 7 (2)
                        authCode: invoiceData.data.invoice.payment_data.authCode, 
                        tid: invoiceData.data.invoice.payment_data.tid,
                        cardDataSource : invoiceData.data.invoice.payment_data.cardDataSource,
                        //transactionNumber: "",// polje 8 (0 or 6) - prazno
                        amount1: params.row.ticket_single_price.toFixed(2),      // polje 10 (Transaction Amount 1) - u najmanjim jedinicama (100 -> 1.00 HRK ako exponent +2) OVO 
                        amount2: "",          // polje 12 OVO
                    
                    });
                    console.log('PAYMENT ', payment)
                    const data = payment.data || {};
                    const flag = data.transactionFlag || '';
                    const approvedFlags = ["01", "02", "99"];
                    if (!payment.ok) {
                        message = payment.error || 'Došlo je do greške pri kartičnom plaćanju. NOK';
                        severity = 'error'
                        isOk = false;
                    }else if (data.displayMessage === "LIMIT PREKORACEN") {
                        message = "LIMIT PREKORACEN";
                        severity = 'error'
                        isOk = false;
                        
                    }else if (data.displayMessage === "ALREADY REF") {
                        message = "Transakcija je već stornirana.";
                        severity = 'error'
                        isOk = false;                
                    }else if (data.displayMessage === "") {
                        message = "Došlo je do greške pri kartičnom plaćanju. Nepoznat razlog";
                        severity = 'error'
                        isOk = false;                
                    }else if (!approvedFlags.includes(flag)) {
                        message = `Kartično plaćanje nije odobreno. Kod: ${flag} - ${data.displayMessage || 'Nepoznat razlog'}`;
                        severity = 'error'
                        isOk = false;
                    }else if(approvedFlags.includes(flag)){
                        message = "Račun je uspiješno storniran";
                        severity = 'success'
                        paymentResponse = data;
                        paymentMethod = await appData.basicData.payment_methods.find((pay)=> (pay.uuid || pay.payment_method_uuid) === invoiceData.data.invoice.invoice_payment_method_uuid)
                    }else{
                        message = "Nepoznat status";
                        severity = 'error'
                        isOk = false;
                    }
                }else{
                    paymentMethod = await appData.basicData.payment_methods.find((pay)=> (pay.uuid || pay.payment_method_uuid) === invoiceData.data.invoice.invoice_payment_method_uuid)
                }
            }
            
        }
        if(isOk){
            const dataToSend = {
                ticket: params.row,
                user: appData.logedUser,
                payment: paymentMethod,
                paymentData: paymentResponse,
                stornoPct,
            };
            console.log(dataToSend)
            const res = await window.api.app.cancelTicketIPC(dataToSend);
            if (res && res.ok === false) {
                message = res.error?.message || 'Storno karte nije uspio';
                severity = 'error';
                console.error('[storno karte] neuspjeh:', res.error);
            } else if (!message) {
                message = 'Karta je uspješno stornirana';
            }
        }
        await dispatch(setStateData({path:'loadingText', value:'Ažuriranje podataka...'}))
        const ticketsData = await window.api.app.getTicketsIPC()
        console.log(ticketsData)
        await dispatch(setStateData({path:'workingData/tickets', value: ticketsData.data.tickets }))
        await dispatch(setStateData({path:'alertData', value:{message:message,severity:severity}})) 
        await dispatch(setStateData({path:'status', value:'ready'}))
    }

    const style = {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        bgcolor: "background.paper",
        border: "2px solid #000",
        boxShadow: 24,
        p: 4,
    };

    return(
        <>
        {stornoPicker.dialog}

        <Modal
            open={cancelPaymentModal}
            onClose={() => closeWithAnswer({status:false, data:''})}
            aria-labelledby="parent-modal-title"
            aria-describedby="parent-modal-description"
            sx={{
                zIndex: (theme) => theme.zIndex.modal + 10
            }}
        >
            <Box
                sx={{
                    ...style,
                    width: '40%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                 <Typography
                    id="modal-modal-title"
                    variant="h6"
                    component="h2"
                    align="center"
                    sx={{ mb: 2 }}
                    >
                    Nije moguće izvršiti kartični povrat sredstava
                </Typography>
                 <Typography
                    id="modal-modal-title"
                    variant="h6"
                    component="h2"
                    align="center"
                    sx={{ mb: 4  }}
                    >
                    Izaberite drugo sredstvo plaćanja za povrat
                </Typography>

                 <Stack direction="row" spacing={2}>
                    {appData.basicData.payment_methods.map((payment)=>(
                        payment.payment_type_acr === 'K' ? '': 

                            <Button
                            key={payment.id}
                            variant="contained"
                            sx={{
                                height: 150,
                                mb: 1,
                                width: "100%",
                            }}
                            onClick={() => closeWithAnswer({status:true, data:payment})}
                            >
                            {payment.payment_method_name}
                            </Button>
                        
                    ))}
                </Stack>
            </Box>
        </Modal>
        <Box
            sx={{
                m: 1,
                position: 'relative',
            }}
            >
                {/* Stornirana karta se ne ispisuje — ne vrijedi za ukrcaj, a
                    otisnuta izgleda kao valjana. */}
                <Fab
                color="primary"
                sx={{
                    width: 40,
                    height: 40,
                }}
                disabled={jeStornirana}
                onClick={handlePrintTicket}
                title={jeStornirana ? "Stornirana karta se ne ispisuje" : "Ispiši kopiju karte"}
                >
                <PrintIcon />
                </Fab>
                <Fab
                color="error"
                sx={{
                    width: 40,
                    height: 40,
                    ml:1
                }}
                disabled={jeStornirana}
                onClick={handleCancelTicket}
                title={jeStornirana ? "Karta je već stornirana" : "Storniraj kartu"}
                >
                <CancelIcon />
                </Fab>
            </Box>
        </>
    )
}