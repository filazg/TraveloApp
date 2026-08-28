import { useState } from "react";
import { Box, Chip, IconButton, Modal, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";

import CloseIcon from "@mui/icons-material/Close";
import TicketsActions from "./TicketsActions";
import ExternalTicketStorno from "./ExternalTicketStorno";
import { gridModalSx, gridBoxSx } from "./listModalStyles";



export default function TicketsListModal() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const [rowId, setRowId] = useState(null);

    const handleTicketsModalClose = async () =>{
        await dispatch(setStateData({path:'modalsStates/showTicketsModal', value: false}))
    }

    const columns = [
        // Velika slova s razmakom u zaglavlju zauzimaju vise od obicnog teksta,
        // pa se "Oznaka karte" rezalo — skraceno na "Oznaka".
        { field: 'ticket_code', headerName: 'Oznaka', width: 160},
        { field: 'line_name', headerName: 'Linija', flex: 3},
        { field: 'ticket_departure_harbor_name', headerName: 'Od', flex: 1},
        { field: 'ticket_departure', headerName: 'Polazak', width: 170, align: 'right', headerAlign: 'right'},
        { field: 'ticket_arrival_harbor_name', headerName: 'Do', flex: 1},
        { field: 'ticket_arrival', headerName: 'Dolazak', width: 170, align: 'right', headerAlign: 'right'},
        { field: 'ticket_type_name', headerName: 'Kategorija', flex: 1.5},
        { field: 'ticket_status', headerName: 'Status', width: 150, align: 'center', headerAlign: 'center',
            // Oznaka umjesto obojenog cijelog polja — puna boja preko retka je
            // gutala tekst i tukla se s bojom retka pri prelasku mišem.
            renderCell: (params) => {
                const map = {
                    'ISSUED':   { color: 'success', text: 'IZDANA' },
                    'VALIDATE': { color: 'info',    text: 'VALIDIRANA' },
                    'CANCELED': { color: 'error',   text: 'STORNIRANA' },
                }
                const conf = map[params.value]
                if (!conf) return null
                return <Chip size="small" label={conf.text} color={conf.color} sx={{ fontWeight: 700 }} />
            },

         },
        {
            field: 'actions',
            type: 'actions',
            headerAlign: "right",
            align: 'right',
            headerName: 'Radnje',
            width:150,
            renderCell: (params) => (
                <TicketsActions {...{ params, rowId, setRowId, }} />
            ),
        },
    ];

    return(
         <>
            <Modal
                open={appData.modalsStates.showTicketsModal}
                onClose={handleTicketsModalClose}
                aria-labelledby="parent-modal-title"
                aria-describedby="parent-modal-description"
            >
                <Box sx={gridModalSx}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>Karte</Typography>
                        <IconButton onClick={handleTicketsModalClose}><CloseIcon /></IconButton>
                    </Stack>
                    {/* Traženje po oznaci stoji iznad popisa: karta s drugog
                        prodajnog mjesta nije u ovom popisu i ne može biti, pa
                        je traženje jedini put do nje. */}
                    <ExternalTicketStorno />
                    <Box sx={gridBoxSx}>
                        <DataGrid
                            rows={appData.workingData.tickets || []}
                            columns={columns}
                            getRowId={(row) => row.id}
                            rowHeight={56}
                            disableColumnMenu
                            disableRowSelectionOnClick
                            localeText={{ noRowsLabel: "Nema karata" }}
                        />
                    </Box>
                </Box>
            </Modal>
        </>
    )
}
