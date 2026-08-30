import React, { use, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { boatSliceData } from "../../boatSlice";
import {
  Box,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Divider,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Modal,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DataGrid } from "@mui/x-data-grid";
import dayjs from "dayjs";

export default function AddTimetablesRoutesDrawer({newData, setNewData}){
    const boatsData = useSelector(boatSliceData)

    const [departures, setDepartures] = useState({});
    const [selectedRow, setSelectedRow] = useState(null);
    const handleSetDeparture = (e)=>{
      setDepartures({
        ...departures,
        [e.target.name]: e.target.value,
      });
    }

    const handleAddDepartureRoute = async()=>{
      console.log("add departure route",departures)
      let departureData = newData.departures
      const newId =
          departureData.length === 0
            ? 1
            : Math.max(...departureData.map(i => i.id)) + 1;
      const newDepartureData = {
        id:newId,
        harbor_from: departures.harbor_from.name,
        harbor_from_uuid: departures.harbor_from.uuid,
        harbor_from_code: departures.harbor_from.code,
        harbor_from_time: departures.harbor_from_time,
        harbor_to: departures.harbor_to.name,
        harbor_to_uuid: departures.harbor_to.uuid,
        harbor_to_code: departures.harbor_to.code,
        harbor_to_time: departures.harbor_to_time,
        // Plovilo odabrano gore vrijedi za cijeli plovidbeni red, ali se u tablici
        // može promijeniti za pojedinu relaciju.
        boat_uuid: newData.boat?.uuid || null
      }
      departureData = [...departureData, newDepartureData]
      setNewData({...newData, departures: departureData})
      setDepartures({})
    }

    const handleRemoveRow = async () =>{
      const departureData = newData.departures.filter((departure) => departure.id !== selectedRow.id);
       setNewData({...newData, departures: departureData})
       setSelectedRow(null)
    }
    
    const columns = [
      { field: "harbor_from", headerName: "luka od", flex: 3, editable: true },
      {
        field: "harbor_from_code",
        headerName: "luka od šifra",
        flex: 3,
        editable: true,
      },
      { field: "harbor_to", headerName: "luka do", flex: 3, editable: true },
      { field: "harbor_to_code", headerName: "luka do šifra", flex: 3, editable: true },
      {
        field: "harbor_from_time",
        headerName: "polazak",
        flex: 3,
        editable: true,
      },
      { field: "harbor_to_time", headerName: "dolazak", flex: 3, editable: true },
      {
        field: "boat_uuid",
        headerName: "plovilo",
        flex: 3,
        editable: true,
        type: "singleSelect",
        valueOptions: (boatsData.boatData?.boats || []).map((b) => ({ value: b.uuid, label: b.name })),
      },
    ];
    
    
    const handleChange = (e)=>{
      // Promjena plovila gore povlači i već unesene relacije, ali samo one koje
      // su još na starom plovilu — ručno promijenjeni redci ostaju kakvi jesu.
      if (e.target.name === 'boat') {
        const prevUuid = newData.boat?.uuid || null
        const nextUuid = e.target.value?.uuid || null
        setNewData({
          ...newData,
          boat: e.target.value,
          departures: (newData.departures || []).map((d) =>
            (!d.boat_uuid || d.boat_uuid === prevUuid) ? { ...d, boat_uuid: nextUuid } : d
          ),
        })
        return
      }
      setNewData({...newData, [e.target.name] : e.target.value})
    }
    const handleChangeDays = (e)=>{
      setNewData({...newData, days: {...newData.days, [e.target.name]: e.target.checked}})
    }

    const handleSetDateFrom = async (data) => {
      setNewData({...newData, date_from: data.toUTCString()});
    };
    const handleSetDateTo = async (data) => {
      setNewData({...newData, date_to: data.toUTCString()});
    };

    useEffect(()=>{
      console.log(newData);
    },[newData])

    const style = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 600,
      hight: "75vh",
      bgcolor: "background.paper",
      boxShadow: 24,
      pt: 2,
      px: 4,
      pb: 3,
    };

    return(
    <>
        <Box sx={{ p:1 }}>
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
           <Grid container justifyContent='center' spacing={2}>
            
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label="Naziv plovidbenog reda"
                    placeholder="Naziv plovidbenog reda"
                    required
                    value={newData.name || ""}
                    onChange={handleChange}
                    name="name"
                    sx={{
                    width: 380,
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label="Oznaka plovidbenog reda"
                    placeholder="Oznaka plovidbenog reda"
                    value={newData?.code || ""}
                    onChange={handleChange}
                    name="code"
                    sx={{
                    width: 380,
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label="Oznaka plovidbenog reda"
                    placeholder="Oznaka plovidbenog reda"
                    value={newData?.code || ""}
                    onChange={handleChange}
                    name="code"
                    sx={{
                    width: 380,
                    }}
                />
                
           
            </Grid>
            <Grid container justifyContent='center' spacing={2} sx={{mt:3}}>
                <TextField
                    type="text"
                    variant="outlined"
                    label="Napomena (nije obavezna)"
                    placeholder="npr. vrijedi dok traje remont"
                    value={newData?.note || ""}
                    onChange={handleChange}
                    name="note"
                    multiline
                    minRows={2}
                    sx={{
                    width: 770,
                    }}
                />
            </Grid>
            <Grid container justifyContent='center' spacing={2} sx={{mt:3}}>
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label="Odaberi liniju"
                    placeholder="Odaberi liniju"
                    select
                    value={newData?.line || ""}
                    onChange={handleChange}
                    name="line"
                    sx={{
                    width: 380,
                    }}
                >
                    {boatsData.boatData?.lines?.map((line) => (
                        <MenuItem key={line.id} value={line}>
                        {line.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label="Odaberi plovilo"
                    placeholder="Odaberi plovilo"
                    select
                    value={newData?.boat || ""}
                    onChange={handleChange}
                    name="boat"
                    sx={{
                    width: 350,
                    }}
                >
                    {boatsData.boatData?.boats?.map((boat) => (
                        <MenuItem key={boat.id} value={boat}>
                            {boat.name}
                        </MenuItem>
                    ))}
                </TextField>
                </Grid>
                <Grid container justifyContent='center' spacing={2} sx={{mt:3}}>
                 <FormControl
                  sx={{ mt: 1, ml: 2 }}
                  component="fieldset"
                  variant="standard"
                >
                  <FormLabel component="legend">Dani plovidbe</FormLabel>
                  <FormGroup row sx={{ justifyContent: "center", ml: 3 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.pon)}
                          onChange={handleChangeDays}
                          name="pon"
                        />
                      }
                      label="Ponedjeljak"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.uto)}
                          onChange={handleChangeDays}
                          name="uto"
                        />
                      }
                      label="Utorak"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.sri)}
                          onChange={handleChangeDays}
                          name="sri"
                        />
                      }
                      label="Srijeda"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.cet)}
                          onChange={handleChangeDays}
                          name="cet"
                        />
                      }
                      label="Četvrtak"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.pet)}
                          onChange={handleChangeDays}
                          name="pet"
                        />
                      }
                      label="Petak"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.sub)}
                          onChange={handleChangeDays}
                          name="sub"
                        />
                      }
                      label="Subota"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.ned)}
                          onChange={handleChangeDays}
                          name="ned"
                        />
                      }
                      label="Nedjelja"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          sx={{ width: 75 }}
                          checked={Boolean(newData.days.pra)}
                          onChange={handleChangeDays}
                          name="pra"
                        />
                      }
                      label="Praznik"
                    />
                  </FormGroup>
                </FormControl>
            </Grid>
            <Grid container justifyContent='center' spacing={2} sx={{mt:3}}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label="Datum pocetka primjene"
                      format="DD.MM.YYYY"
                      disablePast
                      sx={{
                        width: 350,
                      }}
                      value={dayjs(newData.date_from)}
                      onChange={(event, newValue) => {
                        console.log("date");
                        handleSetDateFrom(event.$d);
                      }}
                    />
                  </LocalizationProvider>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label="Datum završetka primjene"
                      format="DD.MM.YYYY"
                      disablePast
                      sx={{
                          width: 350,
                          ml:1
                      }}
                      value={dayjs(newData.date_to)}
                      onChange={(event, newValue) => {
                        console.log("date");
                        handleSetDateTo(event.$d);
                      }}
                    />
                  </LocalizationProvider>
            </Grid>
                <Divider sx={{ my: 3 }} />
            <Grid container justifyContent='center' spacing={2} sx={{mt:3}}>
                <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="Početna luka"
                        placeholder="Početna luka"
                        select
                        value={departures.harbor_from || ""}
                        onChange={handleSetDeparture}
                        name="harbor_from"
                        sx={{
                            width: 350,
                        }}
                        >
                            {boatsData.boatData?.harbors?.map((harbor) => (
                                <MenuItem key={harbor.id} value={harbor}>
                                    {harbor.name}
                                </MenuItem>
                            ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="Završna luka"
                        placeholder="Završna luka"
                        select
                        value={departures.harbor_to || ""}
                        onChange={handleSetDeparture}
                        name="harbor_to"
                        sx={{
                            width: 350,
                            ml:1
                        }}
                        >
                            {boatsData.boatData?.harbors?.map((harbor) => (
                                <MenuItem key={harbor.id} value={harbor}>
                                {harbor.name}
                                </MenuItem>
                            ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="Polazak"
                        placeholder="Polazak"
                        
                        value={departures.harbor_from_time || ""}
                        onChange={handleSetDeparture}
                        name="harbor_from_time"
                        sx={{
                            width: 150,
                            ml:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="Dolazak"
                        placeholder="Dolazak"
                        
                        value={departures.harbor_to_time || ""}
                        onChange={handleSetDeparture}
                        name="harbor_to_time"
                        sx={{
                            width: 150,
                            ml:1
                        }}
                    />
                    <Button
                        variant='contained'
                        sx={{width:200, height:55}}
                        onClick={handleAddDepartureRoute}
                    >
                        DODAJ RELACIJU
                    </Button>
            </Grid>
            <Box
                  sx={{
                    mt: 2,
                    ml: 2,
                    width: "98%", 
                    overflowX: "auto"
                  }}
                >
                  <>
                    <Box
                      sx={{
                        height:"38vh",
                        minWidth: 1200
                    }}
                    >
                      <DataGrid
                        rows={newData.departures || []}
                        columns={columns}
                        processRowUpdate={(updatedRow) => {
                          setNewData({
                            ...newData,
                            departures: (newData.departures || []).map((d) =>
                              d.id === updatedRow.id ? updatedRow : d
                            ),
                          })
                          return updatedRow
                        }}
                        onProcessRowUpdateError={(err) => console.error(err)}
                        // Klik na ćeliju otvara potvrdu brisanja relacije; stupac
                        // "plovilo" je izuzet da bi se uopće mogao urediti.
                        onCellClick={(params) => {
                          if (params.field === 'boat_uuid') return
                          setSelectedRow(params.row)
                        }}
                        //getRowId={(row) => row.id}
                        //onCellEditStart={(params) => setRowId(params.id)}
                        //slots={{ toolbar: CustomToolbar }}
                      />
                    </Box>
                  </>
                </Box>
            <Modal
              open={selectedRow !== null}onClose={() => setSelectedRow(null)}
            >
              <Box sx={{ ...style, width: 300, overflowY: "auto" }}>
                  <Typography sx={{mb:2}} textAlign='center '>Želite li ukloniti relaciju?</Typography>
                  <Typography textAlign='center '>od: </Typography>
                  <Typography textAlign='center '>{selectedRow?.harbor_from} - {selectedRow?.harbor_from_time}</Typography>
                  <Typography textAlign='center '>do: </Typography>
                  <Typography textAlign='center '> {selectedRow?.harbor_to} - {selectedRow?.harbor_to_time}</Typography>
                    <Button
                      variant='contained'
                      sx={{
                        color: 'white',
                        backgroundColor: '#d32f2f',
                        width: '100%',
                        mt: 2,
                        ml: 2,}}
                      onClick={handleRemoveRow}
                    >
                      UKLONI RELACIJU
                    </Button>
              </Box>
          </Modal>
        </Paper>
    </Box>
    </>
    )
}