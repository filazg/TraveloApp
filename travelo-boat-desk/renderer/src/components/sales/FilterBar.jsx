import { use, useEffect, useState } from "react";
import { Box, Button, Chip, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Autocomplete from "@mui/material/Autocomplete";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

import { useDispatch, useSelector } from "react-redux";
import { allAppData, resetStateData, setStateData } from "../../store/appSlice";
import ShortcutHint from "../common/ShortcutHint";

// Pomaknut polazak: plovidbeni red ostaje u `departure`, stvarno vrijeme je u
// `actual_departure`. Blagajna prodaje po stvarnom vremenu, pa se ono i
// prikazuje, a planirano stoji uz oznaku da se zna zašto se razlikuje.
const samoVrijeme = (v) => {
    const m = /(\d{1,2}):(\d{2})/.exec(String(v || ""));
    return m ? String(m[1]).padStart(2, "0") + ":" + m[2] : "";
};

const jePomaknut = (r) => !!(r?.departure && r?.actual_departure && r.departure !== r.actual_departure);

const vrijemePolaska = (r) => (jePomaknut(r) ? samoVrijeme(r.actual_departure) : (r?.departure_time || ""));

export default function FilterBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const transportData = appData.transportData;
    const [day, setDay] = useState();

    //Odabir linije

  const handleOpenSubsidizedModal = () => {
    dispatch(setStateData({ path: "modalsStates/showSubsidisedTickets", value: true }));
  };


    // Sve ispod datuma je izračunato za taj konkretni datum: luka polaska nudi
    // polaske tog dana, relacije i cijene vise o odabranom polasku. Kad se datum
    // promijeni, to se mora počistiti — inače na ekranu ostane jučerašnji polazak
    // uz novi datum i blagajnik proda kartu za krivi dan.
    // Linija i njezine luke (lineHarbors) ne ovise o datumu pa ostaju.
    const DATE_DEPENDENT_PATHS = [
        'searchData/selectedFromHarbor',
        'searchData/availableDepartures',
        'searchData/selectedDeparture',
        'searchData/harborsForSelectedDeparture',
        'searchData/bookingData',
        'searchData/selectedTrip',
        'searchData/selectedTripPrices',
        'searchData/ticketsCounter',
    ];

    const applyTravelDate = async (date) => {
        const value = date.toLocaleDateString("en-GB");
        // Ponovni odabir istog datuma (npr. klik na DANAS kad je već danas) ne
        // smije obrisati ono što je blagajnik u međuvremenu odabrao.
        if (value !== appData.searchData?.travelDate) {
            await dispatch(resetStateData({ paths: DATE_DEPENDENT_PATHS }));
        }
        await dispatch(setStateData({ path:'searchData/travelDate', value }));
        setDay(date);
    };

    const handleSetDate = async(date) => {
        await applyTravelDate(date);
    };

    const handleSetToday = async() => {
        await applyTravelDate(new Date());
    };

    useEffect(() => {
        handleSetToday();
    }, []);

    // Ekran natrag na početak: pretraga (linija, luke, polasci, relacije,
    // cijene, brojači karata) i prodaja (košarica, R1 kupac, način plaćanja).
    // Datum se vraća na danas. Isto što se dogodi i nakon izdanog računa, samo
    // na zahtjev — kad blagajnik želi krenuti ispočetka.
    const handleResetForm = async () => {
        await dispatch(resetStateData({ paths: ['searchData', 'saleData'] }));
        await handleSetToday();
    };

    // Prečaci s tipkovnice — vidi KeyboardShortcuts. Ovdje su radnje koje žive
    // u traci pretrage.
    const shortcutSignal = appData.shortcutSignal;
    useEffect(() => {
        const akcija = shortcutSignal?.action;
        if (!akcija) return;
        if (akcija === 'reset') { handleResetForm(); return; }
        if (akcija === 'subsidised') {
            // Isti uvjet kao na gumbu: bez otočne cijene na odabranoj relaciji
            // modal nema cjenovni stavak i otvarati ga nema smisla.
            if (hasIslandPrice) handleOpenSubsidizedModal();
            return;
        }
    }, [shortcutSignal]);

    const handleSetLine = async (line) => {
        console.log("ODABRANA LINIJA:", line);
        await dispatch(resetStateData({path:'searchData'}));
        // Brisanje linije (x u polju) samo očisti pretragu — bez ovoga bi
        // `line.code` niže puknuo na null.
        if (!line) {
            await handleSetToday();
            return;
        }
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
        // Redoslijed je dolazio onakav kakav je stigao iz plovidbenog reda, pa su
        // popodnevni polasci znali stajati iznad jutarnjih. Sortira se po satu
        // polaska ("HH:mm" pretvoren u minute, da radi i ako sat nije dvoznamenkast).
        const minutes = (time) => {
            const [h, m] = String(time || '').split(':');
            return (Number(h) || 0) * 60 + (Number(m) || 0);
        };
        uniqueDepartures.sort((a, b) => minutes(vrijemePolaska(a)) - minutes(vrijemePolaska(b)));
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
        // Odvojene ovisnosti, ne `a || b || c` — taj izraz je jedna vrijednost, pa
        // dok je luka odabrana promjena datuma nije osvježavala popis polazaka.
        //
        // Plovidbeni red je u ovisnostima jer ga poslužitelj zna osvježiti sam (otkaz
        // ili pomak polaska): bez toga bi na ekranu ostao popis polazaka od
        // maloprije, pa bi blagajnik i dalje vidio polazak kojeg više nema —
        // podaci su novi, ali ekran star.
    }, [appData.searchData.selectedFromHarbor, appData.searchData.selectedLine, appData.searchData.travelDate, appData.transportData]);

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
        // Bez vlastitog paddinga — razmak oko trake daje ekran koji je ugošćuje
        // (SalesScrean). Prije su se zbrajali pa je traka bila uvučenija od
        // stupaca ispod.
        width: "100%",
        maxWidth: 1600, // kiosk friendly, možeš maknuti za full responsive
        mx: "auto",
      }}
    >
      {/* Bez kartice — traka je sama po sebi bijela ploha punom širinom, kao
          donja traka s gumbima. Kartica je ostavljala razmak do zaglavlja. */}
      <Box>
        <Grid
        item
        sx={{
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
            gridTemplateAreas: `"two two four four reset six seven eight"
                        "two2 two2 four1 four1 reset six1 seven eight"`,
          }}
        >
            {/* Kontrolirano poljem iz searchData — dok je bilo nekontrolirano,
                osvježavanje forme bi obrisalo state ali bi naziv linije ostao
                ispisan u polju. */}
            <Autocomplete
              disablePortal
              id="line"
              fullWidth
              options={transportData?.lines || []}
              getOptionLabel={(option) => option.name}
              value={appData.searchData?.selectedLine || null}
              isOptionEqualToValue={(option, value) => option.code === value?.code}
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
                {/* Bez praznog izbora — luka je obavezna, a "None" je samo
                    nudio način da se pretraga vrati u polovično stanje. Za
                    čišćenje postoji OSVJEŽI FORMU. */}
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
                {appData.searchData?.availableDepartures?.map((departure) => (
                <MenuItem key={departure.id} value={departure}>
                    {vrijemePolaska(departure) + " -> smjer " + departure.direction}
                    {jePomaknut(departure) && (
                        <Chip
                            label={"pomaknut, po redu " + samoVrijeme(departure.departure)}
                            color="warning"
                            size="small"
                            sx={{ ml: 1, fontWeight: 700, height: 20, fontSize: 11 }}
                        />
                    )}
                </MenuItem>
            ))}
          </TextField>
          {/* Žuto jer briše i košaricu i kupca — dovoljno različito od plavih
              gumba prodaje da se ne pritisne u prolazu. */}
          <Button
            variant="contained"
            color="warning"
            startIcon={<RefreshIcon />}
            sx={{
              gridArea: "reset",
              height: "100%",
              fontSize: "1.1rem",
              lineHeight: 1.2,
            }}
            onClick={handleResetForm}
          >
            OSVJEŽI FORMU<ShortcutHint action="reset" />
          </Button>
           <Button
            disabled={!canScan}
            variant="contained"
            color={hasIslandPrice ? "warning" : "primary"}
            sx={{
              // Isti font kao gumbi u stupcu Plaćanje i donjoj traci.
              gridArea: "eight",
              fontSize: "1.1rem",
              fontWeight: hasIslandPrice ? 800 : 500,
            }}
            onClick={handleOpenSubsidizedModal}
          >
            POVLAŠTENE KARTICE<ShortcutHint action="subsidised" />
          </Button>
        </Grid>
        </Grid>
      </Box>
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