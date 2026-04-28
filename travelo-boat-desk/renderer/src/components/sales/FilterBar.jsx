import { use, useEffect, useState } from "react";
import { Box, Button, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, resetStateData, setStateData } from "../../store/appSlice";

export default function FilterBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const transportData = appData.transportData;
    const [day, setDay] = useState();

    //Odabir linije

  const handleOpenSubsidizedModal = () => {
    dispatch(setStateData({ path: "modalsStates/showSubsidisedTickets", value: true }));
  };


    const handleSetDate = async(date) => {
        await dispatch(
        setStateData({
            path:'searchData/travelDate',
            value: date.toLocaleDateString("en-GB"),
        })
        );
        //setSearchDataChange(!searchDataChange);
        setDay(date);
        //dispatch(resetSelectedSalesRouteDataAll());
    };

    const handleSetToday = async() => {
        const date = new Date();
        //console.log(date.toLocaleDateString("en-GB"));
        await dispatch(
        setStateData({
            path:'searchData/travelDate',
            value: date.toLocaleDateString("en-GB"),
        })
        );
        //dispatch(resetSelectedSalesRouteDataAll());
        setDay(date);
    };

    useEffect(() => {
        handleSetToday();
    }, []);

    const handleSetLine = async (line) => {
        console.log("ODABRANA LINIJA:", line);
        await dispatch(resetStateData({path:'searchData'}));
        await dispatch(setStateData({path:'searchData/selectedLine', value: line}));
        await handleSetToday();
        //booking
        const harborsData = appData.transportData.routes.filter(
            (route) => route.line_code === line.code
        );
        let uniqueLineHarbors = [
            ...new Set(harborsData.map((x) => x.departure_harbor_id)),
        ];
        let harborsForLine = [];
        for (const harbor of uniqueLineHarbors) {
            const newHarbor = appData.transportData.harbors.find((har) => har.code === harbor);
            harborsForLine = [...harborsForLine, newHarbor];
        }
        await dispatch(setStateData({path:'searchData/lineHarbors', value: harborsForLine}));
    }

     const handleSetTravelFrom = async(e) => {
        const data = e.target.value;
        await dispatch(resetStateData({path:'searchData/harborsForSelectedDeparture'}));
        await dispatch(setStateData({path:'searchData/selectedFromHarbor', value: data}));
    };

    const handleSetDepartures = async() => {
        const routesForSelection = appData.transportData.routes.filter(
            (route) =>
                route.departure_harbor_id === appData.searchData.selectedFromHarbor.code &&
                route.line_code === appData.searchData.selectedLine.code &&
                route.departure_date === appData.searchData.travelDate
            )
        const seen = new Set();
        const uniqueDepartures = [];
        for (const r of routesForSelection) {
            if (seen.has(r.sequence)) continue;
            seen.add(r.sequence);
            uniqueDepartures.push(r);
        }
        await dispatch(setStateData({path:'searchData/availableDepartures', value: uniqueDepartures}));
    }

    const showDepartures = [
        appData.searchData?.selectedLine,
        appData.searchData?.selectedFromHarbor,
    ].every(Boolean);

    useEffect(() => {
        if(appData.searchData?.selectedFromHarbor && appData.searchData?.selectedLine && appData.searchData?.travelDate){
            handleSetDepartures()
            
        }
    }, [appData.searchData.selectedFromHarbor || appData.searchData.selectedLine || appData.searchData.travelDate]);

    const updateBooking = async (data) => {
      const dataToSearch = {
        timetable_uuid: data.timetable_uuid,
        sequence: data.sequence,
      };
      const bookingData = await window.api.app.getOnlineBookingDataIPC(dataToSearch);
      console.log("BOOKING DATA IZ FILTER BARA:", bookingData.data);
      await dispatch(setStateData({path:'searchData/bookingData', value: bookingData.data}));
    };

    const handleSelectDeparture = async(e) => {
        const data = e.target.value;
        await dispatch(setStateData({path:'searchData/selectedDeparture', value: data}));
        await updateBooking(data)
        const harborsForDeparture = appData.transportData.routes.filter(
            (route) =>
                route.line_code === data.line_code &&
                route.departure_harbor_id === data.departure_harbor_id &&
                route.departure_date === data.departure_date &&
                route.sequence === data.sequence &&
                route.arrival_harbor_order > data.departure_harbor_order
        );
        if(harborsForDeparture){
            await dispatch(setStateData({path:'searchData/harborsForSelectedDeparture', value: harborsForDeparture}));
        }
    }

    // Otočna karta postoji u cjeniku samo za određene relacije (is_island === true).
    // Gumb POVLAŠTENE KARTICE smije biti aktivan SAMO kad korisnik odabere konkretnu
    // relaciju (selectedTrip) i ta relacija ima otočnu cijenu — inače modal nema
    // cjenovni stavak za "kartu sa popustom".
    const hasIslandPrice = !!appData.searchData?.selectedTrip
      && !!appData.searchData?.selectedTripPrices?.some((price) => price?.is_island === true);
    const canScan = hasIslandPrice;

  return (
    <Box
      sx={{
        px: 2,
        py: 2,
        width: "100%",
        maxWidth: 1600, // kiosk friendly, možeš maknuti za full responsive
        mx: "auto",
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3,
        }}
      >
        <Grid
        item
        sx={{
          p: 1,
          borderRadius: 2,
          fontSize: "0.875rem",
          fontWeight: "700",
        }}
      >
        <Grid
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 1,
            gridTemplateRows: "auto",
            gridTemplateAreas: `"two two four four six six seven eight"
                        "two2 two2 four1 four1 one six1 seven eight"`,
          }}
        >
            <Autocomplete
              disablePortal
              id="line"
              fullWidth
              options={transportData?.lines || []}
              getOptionLabel={(option) => option.name}
              renderInput={(params) => (
                <TextField {...params} label="Odaberi liniju" />
              )}
              onChange={(event, newValue) => {
                handleSetLine(newValue);
              }}
              sx={{ gridArea: "two" }}
            />

         <Box sx={{ gridArea: "two2" }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Datum putovanja"
                format="DD.MM.YYYY"
                disablePast
                sx={{ width: "75%" }}
                value={dayjs(day)}
                onChange={(event, newValue) => {
                    handleSetDate(event.$d);
                }}
              />
            </LocalizationProvider>
            <Button
              variant="contained"
              sx={{
                width: "25%",
                height: "100%",
              }}
              onClick={handleSetToday}
            >
              DANAS
            </Button>
          </Box>
            <TextField
                //disabled={!showDepartures}
                type="text"
                variant="outlined"
                fullWidth
                label="Odaberi Luku"
                placeholder="Odaberi Luku"
                required
                select
                value={appData.searchData?.selectedFromHarbor || ""}
                onChange={handleSetTravelFrom}
                name="name"
                sx={{ gridArea: "four" }}
            >
                    <MenuItem value="">
                        <em>None</em>
                    </MenuItem>
                {appData.searchData?.lineHarbors?.map((harbor) => (
                <MenuItem key={harbor.id} value={harbor}>
                    {harbor.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
                disabled={!showDepartures}
                type="text"
                variant="outlined"
                fullWidth
                label="Odaberi polazak i smjer"
                placeholder="Odaberi polazak i smjer"
                required
                select
                value={appData.searchData?.selectedDeparture || ""}
                onChange={handleSelectDeparture}
                name="selected_departure"
                sx={{ gridArea: "four1" }}
            >
                    <MenuItem value="">
                        <em>None</em>
                    </MenuItem>
                {appData.searchData?.availableDepartures?.map((departure) => (
                <MenuItem key={departure.id} value={departure}>
                    {departure.departure_time + " -> smjer " + departure.direction}
                </MenuItem>
            ))}
          </TextField>
           <Button
            disabled={!canScan}
            variant="contained"
            color={hasIslandPrice ? "warning" : "primary"}
            sx={{
              gridArea: "eight",
              fontWeight: hasIslandPrice ? 800 : 500,
            }}
            onClick={handleOpenSubsidizedModal}
          >
            POVLAŠTENE KARTICE
          </Button>
        </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

/**
 * POS-friendly styling za inpute:
 * - veća visina
 * - veći font
 * - veći radius
 */
const posFieldSx = {
  "& .MuiInputBase-root": {
    minHeight: 56,
    borderRadius: 2,
  },
  "& .MuiInputLabel-root": {
    fontSize: 14,
  },
};