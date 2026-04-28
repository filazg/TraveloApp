import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { Box, Dialog, DialogContent, DialogTitle, Divider, Modal, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useEffect } from "react";



export default function InvoicePreviewModal({params}) {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const handleClose = async() => {
        dispatch(setStateData({path:'modalsStates/showInvoicePreviewModal', value:false}))
    };

    const invoiceDate = new Date(
        appData.workingData.selectedInvoice.invoice_date
    );

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
        <Modal
            open={appData.modalsStates.showInvoicePreviewModal}
            onClose={handleClose}
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
                <Typography align="center">{appData.workingData.selectedInvoice.invoice_client_name}</Typography>
                <Typography align="center">{appData.workingData.selectedInvoice.invoice_client_address}</Typography>
                <Typography align="center">{appData.workingData.selectedInvoice.invoice_client_postal_code + ' ' + appData.workingData.selectedInvoice.invoice_client_town}</Typography>
                <Typography align="center">{appData.workingData.selectedInvoice.invoice_client_country}</Typography>
                <Typography align="center">OIB: {appData.workingData.selectedInvoice.invoice_client_oib}</Typography>
                <Divider sx={{ my: 1 }} />
                <Typography align="center">{appData.workingData.selectedInvoice.invoice_business_premise_name}</Typography>
                <Typography align="center">{appData.workingData.selectedInvoice.invoice_business_premise_address}</Typography>
                <Typography align="center">{appData.workingData.selectedInvoice.invoice_business_premise_postal_code + ' ' + appData.workingData.selectedInvoice.invoice_business_premise_postal_town}</Typography>
                <Divider sx={{ my: 1 }} />
                {appData.workingData.selectedInvoice.invoice_canceled ? 
                    <>
                        <Typography align="center"><strong>STORNO</strong></Typography> 
                        <Divider sx={{ my: 1 }} />
                    </>
                    : ''}
                <Typography align="center"><strong>{
                    appData.workingData.selectedInvoice.buyer_oib
                        ? "R1 RAČUN BR: " + (appData.workingData.selectedInvoice.invoice_code || (appData.workingData.selectedInvoice.invoice_no + "-" + appData.workingData.selectedInvoice.invoice_year))
                        : "RAČUN BR: " + (appData.workingData.selectedInvoice.invoice_code
                            || (appData.workingData.selectedInvoice.invoice_no + "/" + appData.workingData.selectedInvoice.invoice_business_premise_fiscal_mark + "/" + appData.workingData.selectedInvoice.invoice_billing_device_fiscal_mark))
                }</strong></Typography>
                <Divider sx={{ mt: 1 }} />
                <Divider sx={{ mt: 1 }} />
                <Typography
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%'
                    }}
                    >
                    <span style={{ color: '#64748b' }}>Datum izdavanja:</span>
                    <strong>{invoiceDate.toLocaleDateString('en-GB')}</strong>
                </Typography>
                <Typography
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%'
                    }}
                    >
                    <span style={{ color: '#64748b' }}>Vrijeme izdavanja:</span>
                    <strong>{invoiceDate.toLocaleTimeString('hr-HR')}</strong>
                </Typography>
                <Typography
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%'
                    }}
                    >
                    <span style={{ color: '#64748b' }}>Izdao:</span>
                    <strong>{appData.workingData.selectedInvoice.invoice_operator_name}</strong>
                </Typography>
                <Typography
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%'
                    }}
                    >
                    <span style={{ color: '#64748b' }}>Sredstvo plaćanja:</span>
                    <strong>{appData.workingData.selectedInvoice.invoice_payment_method_name}</strong>
                </Typography>
                <Divider sx={{ mt: 1 }} />
                <TableContainer  sx={{ mt: 2 }}>
                    <Table size="small">
                        <TableHead>
                        <TableRow>
                            <TableCell colSpan={4} align="left">Stavka</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ width: '40%' }} align="left">Kategorija</TableCell>
                            <TableCell sx={{ width: '20%' }} align="right">Cijena</TableCell>
                            <TableCell sx={{ width: '20%' }} align="right">Kol</TableCell>
                            <TableCell sx={{ width: '20%' }} align="right">Iznos</TableCell>
                        </TableRow>
                        </TableHead>
                        <TableBody>
                           {appData.workingData.selectedInvoiceDetails?.invoice_items?.map((row) => (
                            <>
                            <TableRow key={row.id}>
                                <TableCell colSpan={4} align="left">{row.line_name + ' / ' + row.departure_harbor_name + ' -- ' +row.arrival_harbor_name + ' --- ' + row.departure}</TableCell>
                            </TableRow>
                            {row.tickets_group?.map((tg) => (
                           
                            <TableRow key={tg.id}>

                            <TableCell sx={{ width: '40%' }} align="left">{tg.ticket_type_name}</TableCell>
                            <TableCell sx={{ width: '20%' }} align="right">{tg.single_price}</TableCell>
                            <TableCell sx={{ width: '20%' }} align="right">{tg.quantity}</TableCell>
                            <TableCell sx={{ width: '20%' }} align="right">{tg.total_price}</TableCell>
                            </TableRow>
                            ))}
                            </>
                        ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Divider sx={{ mt: 1 }} />
                <Box
                    sx={{
                        width: '50%',
                        ml: 'auto'
                    }}
                    >
                    <TableContainer >
                        <Table sx={{ tableLayout: 'fixed' }}>
                            <TableRow>
                                <TableCell sx={{ py: 0.5 }}>Osnovica:</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">{Number(appData.workingData.selectedInvoice?.invoice_vat_base).toFixed(2) + ' EUR'}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ py: 0.5 }}>PDV 25%:</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">{Number(appData.workingData.selectedInvoice?.invoice_vat).toFixed(2) + ' EUR'}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ py: 0.5 }}>Luč. nak:</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">{Number(appData.workingData.selectedInvoice?.invoice_harbor_tax).toFixed(2) + ' EUR'}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ py: 0.5 }}>Iznos:</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">{Number(appData.workingData.selectedInvoice?.invoice_amount).toFixed(2) + ' EUR'}</TableCell>
                            </TableRow>
                        </Table>
                    </TableContainer>
                </Box>
                <Divider sx={{ mt: 1 }} />  
                {appData.workingData.selectedInvoice.buyer_name ? 
                <>
                <Typography>Kupac:</Typography>
                <Typography>{appData.workingData.selectedInvoice.buyer_name}</Typography>
                <Typography>{appData.workingData.selectedInvoice.buyer_email}</Typography>
                <Typography>{appData.workingData.selectedInvoice.buyer_company_name}</Typography>
                <Typography>{appData.workingData.selectedInvoice.buyer_address}</Typography>
                <Typography>OIB: {appData.workingData.selectedInvoice.buyer_oib}</Typography>
                </>
                :''}
                {appData.workingData.selectedInvoice.payment_data?.tid ?
                <>
                    <Typography sx={{mt:2}} align="center">"KARTIČNO TEREĆENJE / CARD PAYMENT"</Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                        >
                        <span style={{ color: '#64748b' }}>TID:</span>
                        <strong>{appData.workingData.selectedInvoice.payment_data.tid}</strong>
                    </Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                        >
                        <span style={{ color: '#64748b' }}>AID:</span>
                        <strong>{appData.workingData.selectedInvoice.payment_data.aid}</strong>
                    </Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                        >
                        <span style={{ color: '#64748b' }}>Datum i vrijeme:</span>
                        <strong>{appData.workingData.selectedInvoice.payment_data.transactionDate}</strong>
                    </Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                        >
                        <span style={{ color: '#64748b' }}>Kartica:</span>
                        <strong>{appData.workingData.selectedInvoice.payment_data.cardType}</strong>
                    </Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                        >
                        <span style={{ color: '#64748b' }}>Br kartice:</span>
                        <strong>{appData.workingData.selectedInvoice.payment_data.cardNumber}</strong>
                    </Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                        >
                        <span style={{ color: '#64748b' }}>Broj odobrenja:</span>
                        <strong>{appData.workingData.selectedInvoice.payment_data.authCode}</strong>
                    </Typography>
                    <Typography
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                        >
                        <span style={{ color: '#64748b' }}>IZNOS:</span>
                        <strong>{appData.workingData.selectedInvoice.invoice_amount.toFixed(2)+" EUR"}</strong>
                    </Typography>
                    <Typography align="center">{appData.workingData.selectedInvoice.payment_data.displayMessage}</Typography>
                </>
                :''}
                </Box>
        </Modal>
    )
}