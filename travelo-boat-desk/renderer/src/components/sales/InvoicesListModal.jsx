import { Box, Button, Modal, TextField, Typography, useTheme } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";


import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import InvoicesActions from "./InvoiceActions";
import { useEffect, useState } from "react";
import InvoicePreviewModal from "./InvoicePreviewModal";



export default function InvoicesListModal() {
    const theme = useTheme();
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const [rowId, setRowId] = useState(null);

    const handleInvoiceModalClose = async () =>{
        await dispatch(setStateData({path:'modalsStates/showInvoiceView', value: false}))
    }

    const columns = [
        { field: 'invoice_no', headerName: 'Broj računa', flex: 2,align: 'right' },
        {
        field: "invoice_date",
        headerName: "Datum računa",
        flex: 2,
        type: "dateTime",
        align: 'right',
        valueGetter: (params) =>
            params ? new Date(params) : null,

        valueFormatter: (params) => {
            if (!params) return "";

            const date = params;

            const dd = String(date.getDate()).padStart(2, "0");
            const mm = String(date.getMonth() + 1).padStart(2, "0");
            const yyyy = date.getFullYear();
            const hh = String(date.getHours()).padStart(2, "0");
            const min = String(date.getMinutes()).padStart(2, "0");

            return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
        },
        },
        { field: 'invoice_code', headerName: 'Kod računa', flex: 3,align: 'right' },
        { field: 'invoice_operator_name', headerName: 'Operater', flex: 3,align: 'right' },
        { field: 'invoice_payment_method_name', headerName: 'Način plaćanja', flex: 2,align: 'right' },
        { field: 'invoice_status', headerName: 'Status računa', flex: 2,align: 'right',
            renderCell: (params) => {
                const statusRender = (data)=>{
                    let forReturn = {
                        color:'',
                        text:''
                    }
                    if(data === 'issued'){
                        forReturn.color='#2e7d32',
                        forReturn.text='IZDAN'
                    }else if(data === 'canceled'){
                        forReturn.color='#d32f2f',
                        forReturn.text='STORNO'
                    }else if(data === 'canceled-orginal'){
                        forReturn.color='#d32f2f',
                        forReturn.text='STORNIRAN'
                    }else if(data === 'canceled-partial'){
                        forReturn.color='#ed6c02',
                        forReturn.text='DJELOMIČNO'
                    }
                    return(forReturn)
                }
                return (
                <Box display="flex" alignItems="center" justifyContent="center" width="100%" height='100%'
                    sx={{
                        background:statusRender(params.value).color
                    }}
                    >
                    <Typography sx={{mt:1}}>{statusRender(params.value).text}</Typography>
                </Box>
                );
            },

        },
        { field: 'buyer_name', headerName: 'Kupac', flex: 3, },
        {
            field: 'f2_status',
            headerName: 'F2',
            flex: 2,
            align: 'center',
            headerAlign: 'center',
            // Backend YesCor poller je autoritet — desk samo prikazuje sinkronizirana
            // yescor_* polja. "Prošao fiskalizaciju" = fiscalization_status === 'successful'
            // (memory: reference_yescor_f2.md).
            valueGetter: (_value, row) => {
                if (!row.fiskal_required) return 'n/a'
                if (row.yescor_fiscalization_status === 'successful') return 'fiskaliziran'
                if (row.yescor_status === 'failed' || row.yescor_fiscalization_status === 'error') return 'greska'
                return 'obrada'
            },
            renderCell: (params) => {
                const map = {
                    'n/a':         { color: 'transparent', text: '—' },
                    'fiskaliziran':{ color: '#2e7d32',     text: 'F2 OK' },
                    'obrada':      { color: '#ed6c02',     text: 'F2 obrada' },
                    'greska':      { color: '#d32f2f',     text: 'F2 greška' },
                }
                const conf = map[params.value] || map['obrada']
                return (
                    <Box display="flex" alignItems="center" justifyContent="center" width="100%" height="100%"
                         sx={{ background: conf.color }}>
                        <Typography sx={{mt:1}}>{conf.text}</Typography>
                    </Box>
                )
            },
        },
        { field: "invoice_send",
            headerName: "Poslano",
            flex: 1,
            align: "center",
            headerAlign: "center",
            renderCell: (params) => {
                const isSent = params.value === "SEND";

                return (
                <Box display="flex" alignItems="center" justifyContent="center" width="100%">
                    {isSent ? (
                    <CheckCircleIcon sx={{ color: "success.main", mt:2 }} />
                    ) : (
                    <CancelIcon sx={{ color: "error.main", mt:2 }} />
                    )}
                </Box>
                );
            },
        },
        {
            field: 'actions',
            type: 'actions',
            headerAlign: "right",
            align: 'right',
            headerName: 'Actions',
            flex: 3,
            renderCell: (params) => (
                <InvoicesActions {...{ params, rowId, setRowId, }} />
            ),
        },
       
    ];

    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: 'background.paper',
        border: '2px solid #000',
        boxShadow: 24,
        p: 4,
    };

    return(
         <>
            <InvoicePreviewModal/>
            <Modal
                open={appData.modalsStates.showInvoiceView}
                onClose={handleInvoiceModalClose}
                aria-labelledby="parent-modal-title"
                aria-describedby="parent-modal-description"
            >
                <Box
                    sx={{
                        ...style,
                        width: '100%'
                    }}
                >
                    <Box
                        sx={{
                            height: "65vh",
                            width: 'auto',
                            ml:2,
                            mr:2,
                            "& .MuiDataGrid-columnHeaders": {
                                backgroundColor: theme.palette.grey[900],
                            },
                            "& .MuiDataGrid-virtualScroller": {
                                backgroundColor: theme.palette.background.default,
                            },
                            "& .MuiCheckbox-root": {
                                color: theme.palette.success.main,
                            },
                        }}
                    >
                        <DataGrid
                            rows={appData.workingData.invoices || ''}
                            columns={columns}
                            getRowId={(row) => row.id}
                            onCellEditStart={(params) => setRowId(params)}                            
                        />
                    </Box>
                </Box>
            </Modal>
        </>
    )
}