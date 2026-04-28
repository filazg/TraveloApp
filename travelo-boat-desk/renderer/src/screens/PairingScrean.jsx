import { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Divider,
} from "@mui/material";

import { pairDevice, setStateData } from "../store/appSlice";
import SystemSettingsModal from "../components/common/SystemSettingsModal";

export default function PairingScreen() {
  const dispatch = useDispatch();

  const [tid, setTid] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tidClean = useMemo(() => tid.trim(), [tid]);
  const otpClean = useMemo(() => otp.trim(), [otp]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const canSubmit = tidClean.length > 0 && otpClean.length > 0 && !submitting;

  const onOpenSystemSettings = async () => {
    setError("");
    try {
      // Electron opcionalno (ako implementiraš u preload-u)
      if (window?.api?.openSystemSettings) {
        await window.api.openSystemSettings();
        return;
      }
      // fallback: ništa (ili otvori neki interni modal)
      setError("System settings nije dostupno u ovom modu.");
    } catch (e) {
      console.error(e);
      setError("Ne mogu otvoriti system settings.");
    }
  };

  const onSubmit1 = async (e) => {
    e.preventDefault();
    setError("");

    if (!tidClean || !otpClean) {
      setError("Molim unesite TID i OTP.");
      return;
    }

    setSubmitting(true);
    try {
      // pairDevice je thunk (ispod)
      await dispatch(pairDevice({ tid: tidClean, otp: otpClean })).unwrap();
      await dispatch(pairedSet(getpairingData.data.pairing));
      // nakon uspjeha, možeš očistit polja (opcionalno)
      // setTid(""); setOtp("");
    } catch (err) {
      // err može biti string (rejectWithValue) ili error object
      const msg = typeof err === "string" ? err : "Pairing nije uspio.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    console.log("RENDERER:", window.process?.versions);
    setError("");
    await dispatch(setStateData({path:'status', value:'loading'}))
    const pairingValues = {
      tid: tidClean,
      otp: otpClean,
      client_acr: 't4b'
    }
    const paired = await window.api.app.pairingWithBackend(pairingValues)
    console.log("PAIRED DATA:", paired);
    const getpairingData = await window.api.app.getPairingData()
    if(getpairingData.data.pairing?.token){
      await dispatch(setStateData({path:'pairingData', value: getpairingData.data.pairing}));
    }
    console.log("GET PAIRING DATA:", getpairingData);
    await dispatch(setStateData({path:'status', value:'ready'}))
  }

  return (
    <Stack sx={{ height: "100vh" }} alignItems="center" justifyContent="center">
      <Paper sx={{ p: 4, width: 460 }}>
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          <Typography variant="h5">Uparivanje</Typography>
          <Typography variant="body2" color="text.secondary">
            Unesite TID i OTP za uparivanje uređaja.
          </Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="TID"
            value={tid}
            onChange={(e) => setTid(e.target.value)}
            autoFocus
            fullWidth
            inputProps={{ inputMode: "text" }}
          />

          <TextField
            label="OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            fullWidth
            inputProps={{ inputMode: "numeric" }}
          />

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Button
              variant="outlined"
              onClick={() => dispatch(setStateData({path:'modalsStates/showSystemSettingsModal', value:true}))}
              disabled={submitting}
            >
              System settings
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={!canSubmit}
            >
              {submitting ? "Uparujem..." : "Potvrdi"}
            </Button>
          </Stack>
          <SystemSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Stack>
      </Paper>
    </Stack>
  );
}
