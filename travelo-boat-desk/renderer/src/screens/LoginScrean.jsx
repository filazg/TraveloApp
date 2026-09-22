import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { login, selectApp, errorCleared, allAppData, setStateData } from "../store/appSlice";
import BrandMark from "../components/common/BrandMark";
import ThemeToggleButton from "../components/common/ThemeToggleButton";
import SystemSettingsModal from "../components/common/SystemSettingsModal";
import LoadingScreen from "../components/common/LoadingScreen";
import bcrypt from "bcryptjs";

export async function verifyPassword(storedPass, inputPass) {
  if (!storedPass || !inputPass) return false;

  try {
    return await bcrypt.compare(inputPass, storedPass);
  } catch (err) {
    console.error("Password verification error:", err);
    return false;
  }
}

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { error } = useSelector(selectApp);
  const appData = useSelector(allAppData);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  // Ishod sinkronizacije. Dosad se nije prikazivao nigdje, pa je neuspjeh na
  // ovom ekranu prolazio nezapazeno — blagajnik je krenuo u prodaju misleci da
  // je povukao nove podatke.
  const [syncPoruka, setSyncPoruka] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Verzija se čita iz glavnog procesa (app.getVersion) — uvijek točna, neovisno
  // o tome je li renderer bundle rebuildan (__APP_VERSION__ zna ostati star).
  const [appVersion, setAppVersion] = useState(typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "");
  useEffect(() => {
    window?.api?.app?.getAppVersion?.().then((v) => { if (v) setAppVersion(v); }).catch(() => {});
  }, []);

  const canSubmit = username.trim() && password.trim() && !submitting;

  const handleSink = async (e) => {
    e.preventDefault();
    setSyncPoruka(null);
    try {
      await dispatch(setStateData({path:'status', value:'loading'}))
      await dispatch(setStateData({path:'loadingText', value:'Preuzimanje podataka sa servera...'}))
      // Oba IPC-a vracaju { ok, error } umjesto da bacaju, pa se ishod mora
      // provjeriti — isto kao u prodajnom modulu. Bez toga je ovaj ekran sutio
      // i kad posluzitelj nije poslao nista, a lokalna baza ostala od prije.
      const transportRes = await window.api.app.syncTransportBackend()
      const basicRes = await window.api.app.syncBasicBackend()
      const neuspjeh = [
        transportRes?.ok === false ? "plovidbeni red" : null,
        basicRes?.ok === false ? "osnovni podaci" : null,
      ].filter(Boolean);
      const basicData = await window.api.app.getLocalBasicDataIpc()
      await dispatch(setStateData({path:'basicData', value: basicData.data}));
      console.log("SINKRONIZACIJA PODATAKA");
      setSyncPoruka(neuspjeh.length
        ? { severity: "warning", tekst: `Sinkronizacija nije prošla: ${neuspjeh.join(" i ")}. Zadržani su zadnji spremljeni podaci.` }
        : { severity: "success", tekst: "Podaci su sinkronizirani." });
      await dispatch(setStateData({path:'status', value:'ready'}))
    } catch (error) {
      console.error("Greška pri sinkronizaciji podataka:", error);
      setSyncPoruka({ severity: "error", tekst: "Sinkronizacija nije uspjela." });
      await dispatch(setStateData({path:'status', value:'ready'}))
    }
  }

  

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError("");
    await dispatch(setStateData({ path: 'status', value: 'loading' }));
    try {
      const users = appData?.basicData?.users || [];
      if (users.length === 0) {
        setLocalError("Lokalna baza je prazna — pokreni Sinkronizaciju prije prve prijave.");
        return;
      }
      const candidate = users.find((u) => u.user_username === username);
      const passwordOk = candidate ? await verifyPassword(candidate.user_password, password) : false;
      if (!candidate || !passwordOk) {
        setLocalError("Neispravno korisničko ime ili lozinka.");
        return;
      }
      console.log("USER POSTOJI:", candidate);
      await dispatch(setStateData({ path: 'logedUser', value: candidate }));
      // Javi verziju poslužitelju pri prijavi (heartbeat) — fire-and-forget.
      // Uz TID/verziju šalje se i username, da se u administraciji vidi tko se
      // prijavio (log "Uređaji i verzije").
      window?.api?.app?.reportVersion?.(username);
      const getTransportData = await window.api.app.getLocalTransportDataIpc();
      await dispatch(setStateData({ path: 'transportData', value: getTransportData.data }));
      try {
        await dispatch(login({ username, password })).unwrap();
      } catch (_) {
        // error ide u redux state
      }
    } finally {
      await dispatch(setStateData({ path: 'status', value: 'ready' }));
      setSubmitting(false);
    }
  };

  return (
    <>
    <LoadingScreen/>
    <Stack sx={{ height: "100vh" }} alignItems="center" direction="column">
      <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <Paper sx={{ p: 4, width: 420 }}>
         <Stack sx={{ position: "absolute", top: 8, right: 8 }}>
            <ThemeToggleButton />
        </Stack>
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          {/* Isti znak kao na splashu i u zaglavlju blagajne — prijava je prvo
              što blagajnik vidi nakon splasha, pa da to bude isti ekran. */}
          <Stack alignItems="center" spacing={0.5} sx={{ pb: 1 }}>
            <BrandMark variant="h4" />
            <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 600 }}>
              Prijava
            </Typography>
          </Stack>

          {syncPoruka && (
            <Alert severity={syncPoruka.severity} onClose={() => setSyncPoruka(null)}>
              {syncPoruka.tekst}
            </Alert>
          )}

          {(localError || error) && (
            <Alert
              severity="error"
              onClose={() => {
                setLocalError("");
                dispatch(errorCleared());
              }}
            >
              {localError || error}
            </Alert>
          )}

          <TextField
            label="Korisničko ime"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            fullWidth
          />

          <TextField
            label="Lozinka"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />

          <Divider sx={{ my: 1 }} />
          <Button
              type="submit"
              variant="contained"
              disabled={!canSubmit}
            >
              {submitting ? "Prijava..." : "Prijavi se"}
          </Button>
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Button variant="outlined" onClick={() => dispatch(setStateData({path:'modalsStates/showSystemSettingsModal', value:true}))} disabled={submitting}>
            Postavke sustava
            </Button>
            <Button variant="outlined" onClick={handleSink}>
            Sinkronizacija
            </Button>

          </Stack>
        </Stack>
      </Paper>
      </Box>
        <Box
          sx={{
            mb:3
          }}
        >
          <Typography variant="body2">powered by Tech4beez, v.{appVersion}</Typography>
        </Box>
      <SystemSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Stack>
    </>
  );
}
