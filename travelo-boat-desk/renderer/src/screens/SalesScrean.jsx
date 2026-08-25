import { useDispatch } from "react-redux";
import {
  Box,
  Paper,
  Stack,
  Divider,
  Grid,
  Typography,
  IconButton,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';

import { logout, unpair } from "../store/appSlice";
import ThemeToggleButton from "../components/common/ThemeToggleButton";
import SystemSettingsModal from "../components/common/SystemSettingsModal";

import { useState } from "react";
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedDepartureData = true;

  return (
    <>
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
              <Typography variant="h6">TraveloAPP</Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <WifiIcon color="success"/>
              <ThemeToggleButton />
              <IconButton onClick={() => setSettingsOpen(true)} aria-label="settings">
                <SettingsIcon />
              </IconButton>

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
            <Grid
              container
              spacing={2}
              sx={{ height: "100%", width: "100%" }}
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

      <SystemSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
