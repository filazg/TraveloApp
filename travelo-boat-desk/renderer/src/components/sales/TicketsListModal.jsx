import { useEffect, useState } from "react";
import { Box, Modal, Typography, useTheme } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";

import TicketsActions from "./TicketsActions";



export default function TicketsListModal() {
    const theme = useTheme();
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const [rowId, setRowId] = useState(null);

    const handleTicketsModalClose = async () =>{
        await dispatch(setStateData({path:'modalsStates/showTicketsModal', value: false}))
    }

    const columns = [
        { field: 'ticket_code', headerName: 'Oznaka karte', flex: 2},
        { field: 'line_name', headerName: 'Linija', flex: 4},
        { field: 'ticket_departure_harbor_name', headerName: 'Od', flex: 2},
        { field: 'ticket_departure', headerName: 'Polazak', flex: 2},
        { field: 'ticket_arrival_harbor_name', headerName: 'Do', flex: 2},
        { field: 'ticket_arrival', headerName: 'Dolazakk', flex: 2},
        { field: 'ticket_type_name', headerName: 'Kategorija', flex: 2},
        { field: 'ticket_status', headerName: 'Status', flex: 2,
            renderCell: (params) => {
                const statusRender = (data)=>{
                    let forReturn = {
                        color:'',
                        text:''
                    }
                    if(data === 'ISSUED'){
                        forReturn.color='#2e7d32',
                        forReturn.text='IZDANA'
                    }else if(data === 'CANCELED'){
                        forReturn.color='#d32f2f',
                        forReturn.text='STORNIRANA'
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
        {
            field: 'actions',
            type: 'actions',
            headerAlign: "right",
            align: 'right',
            headerName: 'Actions',
            width:130,
            renderCell: (params) => (
                <TicketsActions {...{ params, rowId, setRowId, }} />
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
            <Modal
                open={appData.modalsStates.showTicketsModal}
                onClose={handleTicketsModalClose}
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
                            rows={appData.workingData.tickets || ''}
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