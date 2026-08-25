import { Box, Fab } from "@mui/material";

import PrintIcon from '@mui/icons-material/Print';
import CancelIcon from '@mui/icons-material/Cancel';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { useEffect } from "react";
import { useStornoPercentagePicker } from "./StornoPercentagePicker";

export default function InvoicesActions ({ params, rowId}) {
    const dispatch = useDispatch()
    const appData = useSelector(allAppData);

    // Postotak povrata — isti šifarnik i isti modal kao kod storna pojedine karte.
    const stornoPicker = useStornoPercentagePicker()

    const handlePreviewInvoice = async ()=>{
        console.log(params.row)
        const invoiceDetails = await  await window.api.app.getInvoiceDetailsIPC(params.row.invoice_uuid)
        console.log(invoiceDetails)
        await dispatch(setStateData({path:'workingData/selectedInvoice', value: params.row}))
        await dispatch(setStateData({path:'workingData/selectedInvoiceDetails', value: invoiceDetails.data}))
        await dispatch(setStateData({path:'modalsStates/showInvoicePreviewModal', value: true})) 
        console.log('APP DATA IZ INVOICESA', appData)
    }
    
    const handlePrintInvoice = async()=>{
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Ispis kopije računa...'}))
        const invoicePrint = await  await window.api.app.printInvoiceCopyIPC(params.row.invoice_uuid)
        await dispatch(setStateData({path:'status', value:'ready'}))
        // F2 se ne ispisuje ni kao kopija — bez poruke bi klik na printer izgledao
        // kao da je zakazao.
        if (invoicePrint?.data?.reason === 'f2') {
            await dispatch(setStateData({path:'alertData', value:{
                message:'F2 račun se ne ispisuje — kupcu je dostavljen kao e-račun. Karte se ispisuju zasebno.',
                severity:'info'
            }}))
        }
    }
    
    const handlePrintAllTickets = async()=>{
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Ispis kopija karata...'}))
        const ticketPrint = await  await window.api.app.printAllTicketsCopyIPC(params.row.invoice_uuid)
        console.log(ticketPrint)
        await dispatch(setStateData({path:'status', value:'ready'}))
    }


    
    useEffect(()=>{
        console.log('APP DATA IZ INVOICESA', appData)
    },[appData])

    const handleCancelInvoice = async () => {
        console.log('InVOICE DATA',params.row)
        // Postotak se bira prije svega ostalog — ako blagajnik odustane, ništa se
        // ne dira. Bez šifarnika storno nije moguć; slobodan upis ne postoji.
        if (!stornoPicker.percentages.length) {
            await dispatch(setStateData({path:'alertData', value:{
                message:'Nema definiranih postotaka storniranja. Dodajte ih u portalu (Administracija → Postotci storniranja) i pokrenite sinkronizaciju.',
                severity:'error'
            }}))
            return
        }
        const pctAnswer = await stornoPicker.ask({
            label: `Račun ${params.row?.invoice_code || ''}`,
            amount: Number(params.row?.invoice_amount || 0),
        })
        if (!pctAnswer?.status) return
        const stornoPct = pctAnswer.value

        let payment = {};
        let isOk = true;
        let message = '';
        let severity = 'success'
        let paymentResponse = {};
        let paymentMethod = {}
        const pay= true
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Priprema podataka...'}))
        let canCancel = false;
        if(params.row.invoice_status === 'canceled' || params.row.invoice_status === 'canceled-partial'){
            message = payment.error || 'Račun ne može biti storniran';
            severity = 'error'
            isOk = false;
            //await dispatch(setStateData({path:'alertData', value:{message:'Račun nije moguće stornirati',severity:'error'}})) 
            //await dispatch(setStateData({path:'status', value:'ready'}))
            
        }else{
            let payment = {};
            if(params.row.payment_data && params.row.invoice_payment_method_fiscal_mark === 'K'){
                await dispatch(setStateData({path:'loadingText', value:'Kartično plaćanje...'}))
                
                payment = await window.api.app.cardPaymentIPC({
                    comPort: appData.basicData.settings.pos_port,
                    transactionType: "05",// polje 5 (2) Sale OVO 
                    printerFlag: appData.basicData.settings.pos_print_on_app,     // polje 6 (1)
                    cashierId: "01",      // polje 7 (2)
                    // seq: invoice.payment_details.seq,
                    authCode: params.row.payment_data.authCode, 
                    tid: params.row.payment_data.tid,
                    cardDataSource : params.row.payment_data.cardDataSource,
                    // transactionNumber: invoice.payment_details.transactionNumber,// polje 8 (0 or 6) - prazno
                    amount1: params.row.invoice_amount,       // polje 10 (Transaction Amount 1) - u najmanjim jedinicama (100 -> 1.00 HRK ako exponent +2) OVO 
                    amount2: "",          // polje 12 OVO
                
                });
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
                    }else{
                        message = "Nepoznat status";
                        severity = 'error'
                        isOk = false;
                    }
            }
            if(isOk){
                paymentMethod = await appData.basicData.payment_methods.find((pay)=> (pay.uuid || pay.payment_method_uuid) === params.row.invoice_payment_method_uuid)
                const dataToSend = {
                    invoice: params.row,
                    user: appData.logedUser,
                    payment: paymentMethod,
                    paymentData: paymentResponse,
                    stornoPct,
                };
                const res = await window.api.app.cancelInvoiceIPC(dataToSend);
                if (res && res.ok === false) {
                    message = res.error?.message || 'Storno nije uspio';
                    severity = 'error';
                    console.error('[storno racuna] neuspjeh:', res.error);
                } else if (!message) {
                    message = 'Račun je uspješno storniran';
                }
            }

        }
        await dispatch(setStateData({path:'loadingText', value:'Ažuriranje podataka...'}))
        const getInvoiceData = await window.api.app.getInvoicesIPC()
        console.log('GET INVOICES ', getInvoiceData)
        await dispatch(setStateData({path:'workingData/invoices', value: getInvoiceData.data.invoices }))
        await dispatch(setStateData({path:'status', value:'ready'}))
        await dispatch(setStateData({path:'alertData', value:{message:message,severity:severity}})) 
    }  
    

    return(
        <>
        {stornoPicker.dialog}
        <Box
            sx={{
                m: 1,
                position: 'relative',
            }}
        >
            <Fab
            color="success"
            sx={{
                width: 40,
                height: 40,
            }}
                onClick={handlePreviewInvoice}
            >
            <RemoveRedEyeIcon />
            </Fab>
            <Fab
            color="primary"
            sx={{
                width: 40,
                height: 40,
                ml:1
            }}
            onClick={handlePrintInvoice}
            >
            <PrintIcon />
            </Fab>
            <Fab
            color={params.invoice_status === 'canceled' ? 'success' : "error"}
            sx={{
                width: 40,
                height: 40,
                ml:1
            }}
            onClick={handleCancelInvoice}
            >
            <CancelIcon />
            </Fab>
            <Fab
            color="warning"
            sx={{
                width: 40,
                height: 40,
                ml:1
            }}
            onClick={handlePrintAllTickets}
            >
            <ConfirmationNumberIcon />
            </Fab>
        
        </Box>
        </>
    )
}