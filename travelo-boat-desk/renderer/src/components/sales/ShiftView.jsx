import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, IconButton, Modal, Stack, Typography } from "@mui/material";

import { DataGrid, Toolbar } from "@mui/x-data-grid";

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import DoDisturbOnIcon from '@mui/icons-material/DoDisturbOn';
import { allAppData, setStateData } from "../../store/appSlice";
import OpenNewShiftModal from "./ShiftOpenNew";
import ShiftActions from "./ShiftActions";
import ShiftSummaryModal from "./ShiftSummaryModal";

export default function ShiftsView({}) {
  const dispatch = useDispatch();
  const appData = useSelector(allAppData);
  const [rowId, setRowId] = useState(null);
  
  const handleShiftModalClose = () =>{
    dispatch(setStateData({path:'modalsStates/showShiftView', value:false}))
  }

  const handleNewShiftModalOpen = () => {
    if(appData.canOpenNewShift){
      dispatch(setStateData({path:'modalsStates/showNewShiftView', value:true}))
    }
  };

  const columns = [
    // Broj smjene je id retka iz baze — uređivanje ga je moglo razbiti, a
    // korist nikakva.
    { field: "id", headerName: "Broj smjene", width: 140 },
    {
      field: "operater_name",
      headerName: "Ime operatera",
      flex: 2,
    },
    {
      field: "operater_surname",
      headerName: "Prezime operatera",
      flex: 2,
    },
    {
      field: "shift_start",
      headerName: "Početak smjene",
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
    {
      field: "shift_end",
      headerName: "Završetak smjene",
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
    {
      field: "shift_open",
      headerName: "Otvorena smjena",
      type: 'boolean',
      flex: 2,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        return params.value ? (
          <CheckCircleIcon
            color = 'success'
          />
        ) : (
          <DoDisturbOnIcon
              color = 'error'
          />
        );
      },
    },
    {
      field: "actions",
      type: "actions",
      headerAlign: "right",
      align: "right",
      headerName: "Actions",
      width:150,
      renderCell: (params) => <ShiftActions {...{ params, rowId, setRowId }} />,
    },
  ];
  
 const CustomToolbar = () => {
  return (
    <Toolbar
       sx={{
        minHeight: 80,        // ⬅️ povećava visinu
        px: 2,               // horizontalni padding
        py: 1.5,             // vertikalni padding
        alignItems:'left'   // poravnanje sadržaja na lijevo,
    }}
    >
      <Button
        variant="contained"
        color="success"
        disabled={!appData.canOpenNewShift}
        sx={{ mb: 1,mt:2, width: 200, height:50  }}
        onClick={handleNewShiftModalOpen}
      >
        OTVORI SMJENU
      </Button>
    </Toolbar>
  );
};

  return (
    <>
      <OpenNewShiftModal/>
      <ShiftSummaryModal/>
      <Modal
        open={appData.modalsStates.showShiftView}
        onClose={handleShiftModalClose}
        aria-labelledby="parent-modal-title"
        aria-describedby="parent-modal-description"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "96%",
            height: "90%",
            outline: "none",
            bgcolor: "background.default",
            borderRadius: 3,
            boxShadow: 24,
            p: 3,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Smjene</Typography>
            <IconButton onClick={handleShiftModalClose}><CloseIcon /></IconButton>
          </Stack>
          {/* Tablica preuzima preostalu visinu; prije je imala fiksnu visinu
              unutar okvira koji skrola, pa su se skrolala dva sloja jedan u
              drugom. Zaglavlje ide na istu boju kao naslovi stupaca na
              prodajnom ekranu umjesto na grey[900], koje je u svijetloj temi
              bilo gotovo crno. */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              "& .MuiDataGrid-root": {
                bgcolor: "background.paper",
                borderRadius: 3,
              },
              "& .MuiDataGrid-columnHeader": {
                backgroundColor: "columnHeader",
              },
              "& .MuiDataGrid-columnHeaderTitle": {
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              },
            }}
          >
            <DataGrid
              rows={appData.shiftsData?.shifts || []}
              columns={columns}
              getRowId={(row) => row.id}
              rowHeight={56}
              disableColumnMenu
              disableRowSelectionOnClick
              slots={{ toolbar: CustomToolbar }}
              showToolbar
              localeText={{ noRowsLabel: "Nema smjena" }}
            />
          </Box>
        </Box>
      </Modal>
    </>
  )
}
