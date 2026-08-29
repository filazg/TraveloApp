import { useDispatch } from "react-redux";
import {
  Box,
  Paper,
  Stack,
  Divider,
  Grid,
  Typography,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/AccountCircle";
import SyncIcon from "@mui/icons-material/Sync";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';

import { logout, resetStateData, setStateData, unpair } from "../store/appSlice";
import BrandMark from "../components/common/BrandMark";
import ThemeToggleButton from "../components/common/ThemeToggleButton";
import SystemSettingsModal from "../components/common/SystemSettingsModal";
import OperatorSettingsModal from "../components/common/OperatorSettingsModal";
import KeyboardShortcuts from "../components/common/KeyboardShortcuts";

import { useEffect, useState } from "react";
import FilterBar from "../components/sales/FilterBar";
import BottomBar from "../components/sales/BottomBar";
import ColumnPanel from "../components/sales/ColumnPanel";
import TripsBar from "../components/sales/TripsBar";
import TripPricesBar from "../components/sales/TripPricesBar";
import SelectedTicketsBar from "../components/sales/SelectedTicketsBar";
import ComfirmLogout from "../components/sales/ComfirmLogout";
import OptionsBar from "../components/sales/OptionsBar";
import SubsidisedTicketsSelect from "../components/sales/SubsidisedTicketsSelect";
import AddressBookModal from "../components/sales/AddressBookModal";
import LoadingScreen from "../components/common/LoadingScreen";

export default function SalesScreen() {
  const dispatch = useDispatch();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Isto što radi i gumb SINKRONIZACIJA na prijavi: povuče vozne redove i
  // osnovne podatke s backenda pa osvježi ono što je u memoriji. Ovdje treba
  // jer se vozni red ili cjenik znaju promijeniti usred smjene, a blagajnik se
  // dotad morao odjaviti da bi to povukao.
  // Smjenu u 01:00 zatvara glavni proces. Kad se to dogodi, na ekranu bi inače
  // ostao prijavljen operater čija smjena više ne postoji — pa bi sljedeća
  // prodaja pala jer nema otvorene smjene. Zato se odjavljuje ovdje.
  // Poslužitelj javlja kad se vozni red promijeni (otkaz ili pomak polaska), a
  // glavni proces ga tiho povuče. Ovdje se samo osvježi ono što je na ekranu —
  // bez prekrivanja i bez poruke, da se operatera ne prekida usred prodaje.
  useEffect(() => {
    const odjavi = window.api?.app?.onDataRefreshed?.(async () => {
      const transportData = await window.api.app.getLocalTransportDataIpc();
      dispatch(setStateData({ path: "transportData", value: transportData.data }));
    });
    return () => { if (typeof odjavi === "function") odjavi(); };
  }, [dispatch]);

  useEffect(() => {
    const odjavi = window.api?.app?.onShiftAutoClosed?.(() => {
      dispatch(resetStateData({ path: "logedUser" }));
      dispatch(resetStateData({ path: "searchData" }));
      dispatch(resetStateData({ path: "saleData" }));
      dispatch(setStateData({
        path: "alertData",
        value: { message: "Smjena je automatski zatvorena u 01:00.", severity: "info" },
      }));
    });
    return () => { if (typeof odjavi === "function") odjavi(); };
  }, [dispatch]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    await dispatch(setStateData({ path: "status", value: "loading" }));
    await dispatch(setStateData({ path: "loadingText", value: "Preuzimanje podataka sa servera..." }));
    try {
      // Oba IPC-a vracaju { ok, error } umjesto da bacaju, pa se ishod mora
      // provjeriti. Bez toga je sinkronizacija javljala uspjeh i kad podaci
      // nisu stigli — npr. napomene s naplatnog uredaja nisu se osvjezile, a
      // blagajnik je vidio zelenu poruku.
      const transportRes = await window.api.app.syncTransportBackend();
      const basicRes = await window.api.app.syncBasicBackend();
      const neuspjeh = [
        transportRes?.ok === false ? "vozni red" : null,
        basicRes?.ok === false ? "osnovni podaci" : null,
      ].filter(Boolean);
      const basicData = await window.api.app.getLocalBasicDataIpc();
      await dispatch(setStateData({ path: "basicData", value: basicData.data }));
      // Vozni redovi se drže odvojeno od osnovnih podataka i FilterBar ih čita
      // iz transportData — bez ovoga bi nova pretraga i dalje nudila stari red.
      const transportData = await window.api.app.getLocalTransportDataIpc();
      await dispatch(setStateData({ path: "transportData", value: transportData.data }));
      await dispatch(setStateData({
        path: "alertData",
        value: neuspjeh.length
          ? { message: `Sinkronizacija nije prošla: ${neuspjeh.join(" i ")}. Zadržani su zadnji spremljeni podaci.`, severity: "warning" }
          : { message: "Podaci su sinkronizirani.", severity: "success" },
      }));
    } catch (error) {
      console.error("Greška pri sinkronizaciji podataka:", error);
      await dispatch(setStateData({ path: "alertData", value: { message: "Sinkronizacija nije uspjela.", severity: "error" } }));
    } finally {
      await dispatch(setStateData({ path: "status", value: "ready" }));
      setSyncing(false);
    }
  };

  const selectedDepartureData = true;

  return (
    <>
      <KeyboardShortcuts/>
      <OperatorSettingsModal/>
      <ComfirmLogout/>
      <SubsidisedTicketsSelect/>
      <AddressBookModal/>
      <LoadingScreen/>
      <Box
        sx={{
          minHeight: "100vh",
          p: 2,
          bgcolor: "background.default",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            width: "100%",
            maxWidth: 1600,
            height: "calc(100vh - 32px)", // p:2 = 16px gore + dolje
            borderRadius: 3,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            // Okvir aplikacije je radna ploha, ne kartica — inače bi kartice
            // unutar njega bile bijele na bijelom i ne bi se razlikovale.
            bgcolor: "background.default",
          }}
        >
          {/* HEADER */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.25, minHeight: 64, bgcolor: "background.paper" }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              {/* <HeaderView /> */}
              <BrandMark variant="h6" />
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <WifiIcon color="success"/>
              <ThemeToggleButton />
              {/* Izbornik osobnih postavki operatera. Postavke sustava tu ne
                  spadaju — one su stvar instalacije i otvaraju se s ekrana
                  prijave, iza koda. */}
              <IconButton onClick={handleSync} aria-label="sinkronizacija podataka" disabled={syncing}>
                {/* Ikona se vrti dok sinkronizacija traje — inače nema nikakve
                    naznake da se išta događa, a dohvat traje nekoliko sekundi. */}
                <SyncIcon sx={syncing ? { animation: "vrti 1s linear infinite", "@keyframes vrti": { to: { transform: "rotate(360deg)" } } } : null} />
              </IconButton>
              <IconButton
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                aria-label="izbornik operatera"
              >
                <PersonIcon />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={!!menuAnchor}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    dispatch(setStateData({ path: "modalsStates/showOperatorSettingsModal", value: true }));
                  }}
                >
                  <ListItemIcon><KeyboardIcon fontSize="small" /></ListItemIcon>
                  Funkcijske tipke
                </MenuItem>
              </Menu>

              {/* quick actions (po želji) */}
              {/* <Button variant="outlined" onClick={() => dispatch(logout())}>Logout</Button> */}
            </Stack>
          </Stack>

          <Divider />

          {/* FILTER BAR */}
          {/* Traka punom širinom, spojena sa zaglavljem — isti obrazac kao donja
              traka s gumbima. Prije je bila kartica na krem plohi, pa je gore
              ostajao razmak do zaglavlja. */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: "background.paper",
            }}
          >
            { <FilterBar /> }
          </Box>

          {/* MAIN CONTENT */}
          <Box sx={{ flex: 1, p: 2, overflow: "hidden" }}>
            {/* flexWrap: nowrap — Grid container se inače prelama. Stupci imaju
                fiksne širine, pa je dovoljan piksel manjka da Plaćanje odleti u
                drugi red, a taj red se ne vidi jer je ovaj Box overflow:hidden.
                Izgledalo je kao da je stupac nestao. */}
            <Grid
              container
              spacing={2}
              wrap="nowrap"
              sx={{ height: "100%", width: "100%", flexWrap: "nowrap" }}
            >
              {/* Odredišta (lijevo) */}
              <Grid sx={{ width: 445, flexShrink: 0, height: "100%" }}>
                <ColumnPanel title="Odredišta">
                  <TripsBar/>
                </ColumnPanel>
              </Grid>

              {/* Karte (sredina) */}
              <Grid sx={{ width: 430, flexShrink: 0, height: "100%" }}>
                <ColumnPanel title="Karte">
                  {selectedDepartureData ? (
                    <TripPricesBar/>
                  ) : (
                    <Typography color="text.secondary">
                      Odaberi polazak…
                    </Typography>
                  )}
                </ColumnPanel>
              </Grid>

              {/* Košarica (desno) */}
              <Grid sx={{ width: 430, flexShrink: 0, height: "100%" }}>
                <ColumnPanel title="Košarica">
                  <SelectedTicketsBar />
                </ColumnPanel>
              </Grid>

              {/* Plaćanje (krajnje desno) */}
              <Grid sx={{ width: 213, flexShrink: 0, height: "100%" }}>
                <ColumnPanel title="Plaćanje">
                  <OptionsBar/>
                </ColumnPanel>
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* BOTTOM */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: "background.paper",
              minHeight: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BottomBar/>
          </Box>
        </Paper>
      </Box>

      <SystemSettingsModal />
    </>
  );
}
