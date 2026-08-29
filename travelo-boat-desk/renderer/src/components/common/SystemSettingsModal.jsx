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
  Divider,
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
  const [brojevi, setBrojevi] = useState(null)

  // Trenutno stanje brojača se dohvaća tek kad se otključaju postavke — prije
  // toga forma se ni ne prikazuje.
  useEffect(() => {
    if (!calculated) return
    let otkazano = false
    ;(async () => {
      try {
        const res = await window.api.app.getNextInvoiceNumbersIPC()
        if (!otkazano && res?.ok) setBrojevi(res.data)
      } catch (e) {
        console.log('getNextInvoiceNumbersIPC nije uspio:', e?.message || e)
      }
    })()
    return () => { otkazano = true }
  }, [calculated])

  const handleClose = async() => {
      setCode('')
      setCalculated(false)
      dispatch(setStateData({path:'modalsStates/showSystemSettingsModal', value:false}))
  };

  // Forma se puni kad podaci stignu, i ponovno pri svakom otvaranju.
  //
  // Modal je montiran zajedno s ekranom prijave, dakle prije nego osnovni podaci
  // stignu iz lokalne baze. Pocetna vrijednost useState-a tada je prazna i takva
  // ostaje — polja su izgledala kao da postavke nisu ni zapisane, iako u bazi
  // stoje. Ponovno punjenje pri otvaranju usput odbacuje i nespremljene izmjene
  // iz prethodnog otvaranja.
  const spremljenePostavke = appData.basicData?.settings
  useEffect(() => {
    if (!appData.modalsStates.showSystemSettingsModal) return
    setNewSettingsData(spremljenePostavke || {})
  }, [appData.modalsStates.showSystemSettingsModal, spremljenePostavke])

  const handleChange = (e) => {
        const { name, value } = e.target;

        setNewSettingsData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

  // Brojači idu u bazu kao INTEGER. Prazno polje mora ostati null (granica se
  // ne primjenjuje), a ne 0 ili "" — inače bi Math.max dobio smeće.
  const handleNumberChange = (e) => {
        const { name, value } = e.target;
        const ocisceno = String(value).replace(/\D/g, "");
        setNewSettingsData((prev) => ({
            ...prev,
            [name]: ocisceno === "" ? null : Number(ocisceno),
            // Godina se pamti automatski — granica vrijedi samo za godinu u kojoj
            // je upisana, da ne blokira godišnji reset numeracije.
            next_invoice_year: ocisceno === "" ? prev.next_invoice_year : new Date().getFullYear(),
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
        // Osvježi prikaz brojača — nakon spremanja početka numeracije mora se
        // vidjeti koji će broj sljedeći račun stvarno dobiti.
        try {
          const res = await window.api.app.getNextInvoiceNumbersIPC()
          if (res?.ok) setBrojevi(res.data)
        } catch (e) {
          console.log('getNextInvoiceNumbersIPC nije uspio:', e?.message || e)
        }
        
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
                <FormControlLabel
                    sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    ml: 0,
                    }}
                    control={
                    <Switch
                        checked={settingsData?.printer_cut !== false}
                        onChange={(e) =>
                        setNewSettingsData((prev) => ({
                            ...prev,
                            printer_cut: e.target.checked,
                        }))
                        }
                    />
                    }
                    label={
                    <Typography>
                        Rez papira na printeru
                    </Typography>
                    }
                    labelPlacement="start"
                />
                </Box>

            {/* Numeracija se izvodi iz najvećeg broja u lokalnoj tablici računa.
                Na novom računalu je ta tablica prazna, pa bi brojanje krenulo od
                1 i ponovilo već izdane fiskalne brojeve. Ovdje se upisuje odakle
                se nastavlja. */}
            <Divider sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.secondary">Numeracija računa</Typography>
            </Divider>

            <Alert severity="info" sx={{ mb: 2 }}>
              Popunjava se samo kad se blagajna seli na drugo računalo. Upisani broj
              vrijedi kao najmanji dopušteni — ako lokalni računi već imaju veći broj,
              nastavlja se od njih. Vrijedi za tekuću godinu; iduće godine numeracija
              svejedno kreće od 1.
            </Alert>

            {brojevi ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Sljedeći račun ({brojevi.year}) dobit će fiskalni broj{" "}
                  <strong>
                    {brojevi.next_invoice_fiskal_no}
                    {brojevi.business_premise_fiscal_mark
                      ? `/${brojevi.business_premise_fiscal_mark}/${brojevi.billing_device_fiscal_mark}`
                      : ""}
                  </strong>
                  , redni broj <strong>{brojevi.next_invoice_no}</strong>.
                </Typography>
                {brojevi.floor_year && Number(brojevi.floor_year) === Number(brojevi.year) ? (
                  <Typography variant="body2" color="text.secondary">
                    Postavljeni početak: fiskalni {brojevi.floor_fiskal_no ?? "—"}, redni{" "}
                    {brojevi.floor_no ?? "—"} (iz lokalnih računa bi bilo{" "}
                    {brojevi.from_local_fiskal_no} / {brojevi.from_local_no}).
                  </Typography>
                ) : null}
              </Box>
            ) : null}

            <TextField
                name="next_invoice_fiskal_no"
                label="Sljedeći fiskalni broj računa (NO iz NO/PP/NU)"
                type="number"
                value={settingsData?.next_invoice_fiskal_no ?? ""}
                onChange={handleNumberChange}
                fullWidth
                sx={{ mb: 2 }}
            />
            <TextField
                name="next_invoice_no"
                label="Sljedeći redni broj računa (interni brojač, uključuje F2)"
                type="number"
                value={settingsData?.next_invoice_no ?? ""}
                onChange={handleNumberChange}
                fullWidth
                sx={{ mb: 2 }}
            />

            <Divider sx={{ mb: 2 }} />
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

  
