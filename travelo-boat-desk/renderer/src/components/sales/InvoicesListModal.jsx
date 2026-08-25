import { Box, Chip, IconButton, Modal, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";


import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import InvoicesActions from "./InvoiceActions";
import { useState } from "react";
import InvoicePreviewModal from "./InvoicePreviewModal";
import { gridModalSx, gridBoxSx } from "./listModalStyles";


export default function InvoicesListModal() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const [rowId, setRowId] = useState(null);

    const handleInvoiceModalClose = async () =>{
        await dispatch(setStateData({path:'modalsStates/showInvoiceView', value: false}))
    }

    const columns = [
        // Nazivi zaglavlja su skraćeni: velika slova s razmakom zauzimaju
        // osjetno više od običnog teksta, pa su se "Broj računa" i "Način
        // plaćanja" rezali na tri točkice.
        { field: 'invoice_no', headerName: 'Br.', width: 90, align: 'right', headerAlign: 'right' },
        {
        field: "invoice_date",
        headerName: "Datum",
        width: 170,
        type: "dateTime",
        align: 'right',
        headerAlign: 'right',
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
        // Tekst lijevo, brojevi i datumi desno — prije je sve bilo desno pa su
        // imena i oznake visjele uz desni rub stupca.
        { field: 'invoice_code', headerName: 'Kod', flex: 2 },
        { field: 'invoice_operator_name', headerName: 'Operater', flex: 2 },
        { field: 'invoice_payment_method_name', headerName: 'Plaćanje', flex: 1.5 },
        { field: 'invoice_status', headerName: 'Status', width: 150, align: 'center', headerAlign: 'center',
            // Oznaka umjesto obojenog cijelog polja — puna boja preko retka je
            // gutala tekst i tukla se s bojom retka pri prelasku mišem.
            renderCell: (params) => {
                const map = {
                    'issued':           { color: 'success', text: 'IZDAN' },
                    'canceled':         { color: 'error',   text: 'STORNO' },
                    'canceled-orginal': { color: 'error',   text: 'STORNIRAN' },
                    'canceled-partial': { color: 'warning', text: 'DJELOMIČNO' },
                }
                const conf = map[params.value]
                if (!conf) return null
                return <Chip size="small" label={conf.text} color={conf.color} sx={{ fontWeight: 700 }} />
            },

        },
        { field: 'buyer_name', headerName: 'Kupac', flex: 2, },
        {
            field: 'f2_status',
            headerName: 'F2',
            width: 130,
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
                    'fiskaliziran':{ color: 'success', text: 'F2 OK' },
                    'obrada':      { color: 'warning', text: 'F2 obrada' },
                    'greska':      { color: 'error',   text: 'F2 greška' },
                }
                if (params.value === 'n/a') {
                    return <Typography color="text.secondary">—</Typography>
                }
                const conf = map[params.value] || map['obrada']
                return <Chip size="small" label={conf.text} color={conf.color} sx={{ fontWeight: 700 }} />
            },
        },
        { field: "invoice_send",
            headerName: "Poslano",
            width: 110,
            align: "center",
            headerAlign: "center",
            renderCell: (params) => (
                params.value === "SEND"
                    ? <CheckCircleIcon color="success" titleAccess="Poslano backendu" />
                    : <CancelIcon color="error" titleAccess="Nije poslano — čeka sinkronizaciju" />
            ),
        },
        {
            field: 'actions',
            type: 'actions',
            headerAlign: "right",
            align: 'right',
            headerName: 'Radnje',
            width: 210,
            renderCell: (params) => (
                <InvoicesActions {...{ params, rowId, setRowId, }} />
            ),
        },
       
    ];

    return(
         <>
            <InvoicePreviewModal/>
            <Modal
                open={appData.modalsStates.showInvoiceView}
                onClose={handleInvoiceModalClose}
                aria-labelledby="parent-modal-title"
                aria-describedby="parent-modal-description"
            >
                <Box sx={gridModalSx}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>Računi</Typography>
                        <IconButton onClick={handleInvoiceModalClose}><CloseIcon /></IconButton>
                    </Stack>
                    <Box sx={gridBoxSx}>
                        <DataGrid
                            rows={appData.workingData.invoices || []}
                            columns={columns}
                            getRowId={(row) => row.id}
                            rowHeight={56}
                            disableColumnMenu
                            disableRowSelectionOnClick
                            localeText={{ noRowsLabel: "Nema računa" }}
                        />
                    </Box>
                </Box>
            </Modal>
        </>
    )
}