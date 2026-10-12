import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Typography,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";

// Kredencijali uređaja su istekli (poslužitelj odbija token, a tiha obnova nije
// uspjela). Dosad je blagajna padala na ekran uparivanja: operater je izletio
// iz prodaje i morao ponovno upisati i TID — a s krivim TID-om blagajna bi
// dobila token tuđeg uređaja i pomiješala podatke.
//
// Sada ostaje gdje jest, a ovdje se upisuje samo novi OTP. TID se ne upisuje:
// uzima ga glavni proces iz baze. "Kasnije" pušta rad dalje lokalno (prodaja
// se sprema i čeka slanje); oznaka u kutu ponovno otvara prozor.
export default function SessionExpiredDialog() {
  const dispatch = useDispatch();
  const appData = useSelector(allAppData);
  const tid = appData?.pairingData?.tid || "";

  const [istekao, setIstekao] = useState(false);
  const [otvoren, setOtvoren] = useState(false);
  const [otp, setOtp] = useState("");
  const [greska, setGreska] = useState("");
  const [salje, setSalje] = useState(false);

  useEffect(() => {
    const off = window?.api?.app?.onSessionExpired?.(() => {
      setIstekao(true);
      setOtvoren(true);
    });
    return () => { if (typeof off === "function") off(); };
  }, []);

  useEffect(() => {
    const off = window?.api?.app?.onSessionRestored?.((p) => {
      if (p?.token) dispatch(setStateData({ path: "pairingData/token", value: p.token }));
      setIstekao(false);
      setOtvoren(false);
      setGreska("");
    });
    return () => { if (typeof off === "function") off(); };
  }, [dispatch]);

  const potvrdi = async (e) => {
    e?.preventDefault?.();
    if (!otp.trim()) { setGreska("Upiši OTP."); return; }
    setSalje(true);
    setGreska("");
    try {
      const res = await window.api.app.reauthWithOtp(otp.trim());
      if (!res?.ok) {
        setGreska(res?.error?.message || "Prijava nije uspjela.");
      } else {
        dispatch(setStateData({ path: "pairingData/token", value: res.data?.token }));
        setIstekao(false);
        setOtvoren(false);
        setOtp("");
      }
    } catch (err) {
      setGreska(err?.message || "Prijava nije uspjela.");
    }
    setSalje(false);
  };

  if (!istekao) return null;

  return (
    <>
      {!otvoren && (
        <Box sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1400 }}>
          <Chip
            color="warning"
            label="Uređaj nije spojen — unesi OTP"
            onClick={() => setOtvoren(true)}
            sx={{ fontWeight: 700, cursor: "pointer", boxShadow: 3 }}
          />
        </Box>
      )}
      <Dialog open={otvoren} maxWidth="xs" fullWidth onClose={() => {}}>
        <Box component="form" onSubmit={potvrdi}>
          <DialogTitle sx={{ fontWeight: 800 }}>Kredencijali uređaja su istekli</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Za nastavak rada s poslužiteljem unesite novi OTP za ovaj uređaj. Podaci na blagajni
                ostaju sačuvani; neposlani računi i smjene šalju se čim se uređaj ponovno spoji.
              </Typography>
              <TextField label="TID" value={tid} InputProps={{ readOnly: true }} disabled fullWidth />
              <TextField
                label="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoFocus
                fullWidth
                disabled={salje}
              />
              {greska && <Alert severity="error">{greska}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOtvoren(false)} disabled={salje}>Kasnije</Button>
            <Button type="submit" variant="contained" disabled={salje}>
              {salje ? "Provjera…" : "Potvrdi"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
