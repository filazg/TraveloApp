import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  Alert,
  TextField,
  Box,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { allAppData, setStateData } from "../../store/appSlice";
import { useDispatch, useSelector } from "react-redux";

export default function SystemSettingsModal() {
  const dispatch = useDispatch();
  const appData = useSelector(allAppData);
  const [settingsData, setNewSettingsData] = useState(appData.basicData.settings)
  const [code, setCode] = useState('')
  const [calculated, setCalculated] = useState(false)

  const handleClose = async() => {
      setCode('')
      setCalculated(false)
      dispatch(setStateData({path:'modalsStates/showSystemSettingsModal', value:false}))
  };

  useEffect(()=>{
    console.log('SETTINGS', settingsData)
  },[])

  const handleChange = (e) => {
        const { name, value } = e.target;

        setNewSettingsData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };


  function isoDow(date = new Date()) {
    const d = date.getDay(); // 0..6 (ned..sub)
    return d === 0 ? 7 : d;  // 1..7 (pon..ned)
  }

  function calcValueFromNow(date = new Date()) {
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const dow = isoDow(date);
    const result = (hour + day + dow) * month;
    console.log({ hour, day, dow, month, result });
    return (hour + day + dow) * month;
  }

  const handleCalculate = () => {
    const expected = calcValueFromNow();

    console.log("code:", code);
    console.log("expected:", expected);

    if (Number(code) === expected) {
        setCalculated(true);
    }
  };

  function codeForm() {
      return(
      <>
          <Typography
              sx={{mb:2}}
          >
              UNESI KOD
          </Typography>
              <TextField
                  name="code"
                  label="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  />
          <Button sx={{ height: 75 }} onClick={handleCalculate} fullWidth variant="contained">POTVRDI</Button>   
      </>
      )
    }


     const handleSubmit = async()=>{
        //dispatch(setLoading({value:true}))
        console.log('SUBMIT ', settingsData)
        const setData = await window.api.app.setSystemSettingsDataIpc(settingsData);
        const basicData = await window.api.app.getLocalBasicDataIpc()
        
        await dispatch(setStateData({path:'basicData', value: basicData.data}));
        
        //const getSettingsData = await window.api.e_setInitialSettingsData();
      
        //dispatch(setStateData({path:'showSettingsModal', value: false}))
        //dispatch(setLoading({value:false}))
    }

  function settingsForm() {
      return (
        <>
      <DialogTitle>System settings</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Odaberi što želiš otvoriti u postavkama sustava.
          </Typography>
           <TextField
                name="backend_url"
                label="Adresa backend sustava"
                value={settingsData?.backend_url || ""}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
                />
           <TextField
                name="printer_location"
                label="Printer za ispis računa"
                value={settingsData?.printer_location || ""}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
                />
            <TextField
                name="printer_ticket_location"
                label="Printer za ispis karata"
                value={settingsData?.printer_ticket_location || ""}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
                />
            <TextField
                name="printer_width"
                label="Širina ispisa"
                value={settingsData?.printer_width || ""}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
                />
            <TextField
                name="card_reader"
                label="card_reader"
                value={settingsData?.card_reader || ""}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
            />
            <TextField
                name="pos_port"
                label="EFTPOS port"
                value={settingsData?.pos_port || ""}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
            />
                <Box sx={{ width: "100%", mb: 2 }}>
                <FormControlLabel
                    sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    ml: 0,
                    }}
                    control={
                    <Switch
                        checked={settingsData?.auto_validate || false}
                        onChange={(e) =>
                        setNewSettingsData((prev) => ({
                            ...prev,
                            auto_validate: e.target.checked,
                        }))
                        }
                    />
                    }
                    label={
                    <Typography>
                        Automatska validacija karata
                    </Typography>
                    }
                    labelPlacement="start"
                />
                <FormControlLabel
                    sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    ml: 0,
                    }}
                    control={
                    <Switch
                        checked={settingsData?.pos_print_on_app || false}
                        onChange={(e) =>
                        setNewSettingsData((prev) => ({
                            ...prev,
                            pos_print_on_app: e.target.checked,
                        }))
                        }
                    />
                    }
                    label={
                    <Typography>
                        Ispis platnog slipa na blagajni
                    </Typography>
                    }
                    labelPlacement="start"
                />
                <FormControlLabel
                    sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    ml: 0,
                    }}
                    control={
                    <Switch
                        checked={settingsData?.pos_print_additional_slip || false}
                        onChange={(e) =>
                        setNewSettingsData((prev) => ({
                            ...prev,
                            pos_print_additional_slip: e.target.checked,
                        }))
                        }
                    />
                    }
                    label={
                    <Typography>
                        Ispis dodatnog slipa
                    </Typography>
                    }
                    labelPlacement="start"
                />
                </Box>
            <Button sx={{ height: 60, mb:2 }} fullWidth variant="contained">POŠALJI NEPOSLANE DOKUMNETE</Button> 
            <Button sx={{ height: 60, mb:2 }} fullWidth variant="contained">UKLONI UPARIVANJE</Button> 
            <Button sx={{ height: 60 }} onClick={handleSubmit} fullWidth variant="contained">SPREMI IZMJENE</Button>   
        
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="outlined">
          Zatvori
        </Button>
        
      </DialogActions>
      </>
  );
}

  return(
      <Dialog open={appData.modalsStates.showSystemSettingsModal} onClose={handleClose} fullWidth maxWidth="sm">
        {calculated ?
            settingsForm():    
            codeForm()
        }
      </Dialog>
  )

  }

  
