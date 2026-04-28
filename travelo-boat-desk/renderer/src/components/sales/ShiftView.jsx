import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Modal, useTheme } from "@mui/material";

import { DataGrid, Toolbar, ToolbarButton } from "@mui/x-data-grid";

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoDisturbOnIcon from '@mui/icons-material/DoDisturbOn';
import { allAppData, setStateData } from "../../store/appSlice";
import OpenNewShiftModal from "./ShiftOpenNew";
import ShiftActions from "./ShiftActions";
import ShiftSummaryModal from "./ShiftSummaryModal";

export default function ShiftsView({}) {
  const theme = useTheme();
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
    { field: "id", headerName: "Broj smjene", flex: 3, editable: true },
    {
      field: "operater_name",
      headerName: "Ime djelatnika",
      flex: 3,
    },
    {
      field: "operater_surname",
      headerName: "Prezime operatera",
      flex: 3,
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
      flex: 3,
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
            ...style,
            width: '100%',
            height:'90%',
            overflowY: 'auto',
          }}
        >
          <Box
            sx={{
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
              rows={appData.shiftsData?.shifts || ''}
              columns={columns}
              getRowId={(row) => row.id}
              onCellEditStart={(params) => setRowId(params.id)}
              slots={{ toolbar: CustomToolbar }}
              showToolbar
            />
          </Box>
        </Box>
      </Modal>
    </>
  )
}
