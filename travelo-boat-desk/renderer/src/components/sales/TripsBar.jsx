import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { alpha, Box, Button, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";



export default function TripsBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    // Booking-service drži zapise samo za susjedne etape (npr. Split→Milna, Milna→Hvar).
    // Za polaske preko više etapa (Split→Hvar) slobodna mjesta su minimum
    // svih susjednih etapa koje pokrivaju taj raspon harbor_order-a.
    const capacity = ({ type, id }) => {
        const bookings = appData.searchData?.bookingData || [];
        const depOrder = Number(id.departure_harbor_order);
        const arrOrder = Number(id.arrival_harbor_order);
        const spanning = bookings.filter((b) =>
          Number(b.departure_harbor_order) >= depOrder &&
          Number(b.arrival_harbor_order) <= arrOrder
        );
        if (spanning.length === 0) return 0;
        return Math.min(...spanning.map((b) => Number(b[type]) || 0));
    };

    const handleSelectTrip = async (data) => {
        console.log(data)
            dispatch(
            setStateData({ path:'searchData/selectedTrip', value: data })
            );
        let pricesForTrip = [];
        if (data) {
          console.log('PRICES' , appData.transportData.route_prices)
        const pricesForFirstDirection = appData.transportData.route_prices.filter(
            (price) =>
            price.timetable_uuid === data.timetable_uuid &&
            price.harbor_from_code === data.departure_harbor_id &&
            price.harbor_to_code === data.arrival_harbor_id
        );
        if (pricesForFirstDirection.length === 0) {
            const pricesForSecondDirection = appData.transportData.route_prices.filter(
            (price) =>
                price.timetable_uuid === data.timetable_uuid &&
                price.harbor_to_code === data.departure_harbor_id &&
                price.harbor_from_code === data.arrival_harbor_id
            );
            pricesForTrip = pricesForSecondDirection;
            dispatch(
            setStateData({
                path: 'searchData/selectedTripPrices',
                value: pricesForSecondDirection,
            })
            );
        } else {
            pricesForTrip = pricesForFirstDirection;
            dispatch(
            setStateData({
                path: "searchData/selectedTripPrices",
                value: pricesForFirstDirection,
            })
            );
        }
        if (pricesForTrip) {
            let typeToAdd = [];
            for (const newType of pricesForTrip) {
            const counter = {
                id: newType.id,
                data: newType,
                quantity: 0,
                sales_route: data,
            };
            typeToAdd = [...typeToAdd, counter];
            }
            dispatch(
            setStateData({ path: "searchData/ticketsCounter", value: typeToAdd })
            );
        }
        }
    };


    // Postavka operatera: uz odabrani polazak odmah uzmi prvu ponuđenu relaciju.
    // Bira se prva onako kako je i prikazana, da se poklapa s onim što blagajnik
    // vidi na popisu.
    //
    // Ne dira odabir koji je blagajnik već napravio: ako odabrana relacija
    // postoji u trenutnom popisu, ostaje. Odabire se samo kad popisa dotad nije
    // bilo ili je odabrana relacija iz prethodnog polaska, pa više nije u njemu.
    const relacije = appData.searchData?.harborsForSelectedDeparture;
    const odabrana = appData.searchData?.selectedTrip;
    const automatski = !!appData.operatorSettings?.auto_select_first_arrival;
    useEffect(() => {
        if (!automatski) return;
        if (!relacije?.length) return;
        const jeIzOvogPopisa = odabrana && relacije.some(
            (r) => r.arrival_harbor_id === odabrana.arrival_harbor_id
                && r.departure_harbor_id === odabrana.departure_harbor_id
                && r.sequence === odabrana.sequence
        );
        if (jeIzOvogPopisa) return;
        handleSelectTrip(relacije[0]);
        // handleSelectTrip se stvara iznova pri svakom renderu i nije u
        // ovisnostima namjerno — inače bi se učinak vrtio u krug.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [automatski, relacije, odabrana]);

    // Odabrana relacija mora se vidjeti na prvi pogled: dosad se klikom nije
    // mijenjalo ništa, pa blagajnik nije imao po čemu znati za koje odredište
    // prodaje kartu.
    const jeOdabrana = (relacija) => !!odabrana && odabrana.id === relacija.id;

    return(
        <>
      <Box
        sx={{
          // Visinu i skrolanje daje ColumnPanel; fiksna visina ovdje bi stvorila
          // drugi skrol unutar prvog.
          width: "100%",
        }}
      >
        {appData.searchData?.harborsForSelectedDeparture?.map((departure) => (
          <Button
            key={departure.id}
            // Puna širina stupca umjesto fiksnih 420px — kartica se sama
            // prilagodi, pa nema ni vodoravne trake za pomicanje.
            sx={{ width: "100%", p: 0 }}
            onClick={() => {
              handleSelectTrip(departure);
            }}
          >
            <Paper
              variant="accent"
              sx={{
                width: "100%",
                my: 1,
                p: 1.5,
                ...(jeOdabrana(departure) && {
                  borderWidth: 2,
                  borderColor: "primary.main",
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                }),
              }}
            >
              {/* Odredište lijevo, vrijeme desno — blagajnik traži luku po
                  nazivu, a vrijeme uspoređuje niz desni rub. */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    ...(jeOdabrana(departure) && { color: "primary.main", fontWeight: 800 }),
                  }}
                >
                  {departure.arrival_harbor_name}
                </Typography>
                {/* Kad je polazak pomaknut, vrijedi stvarno vrijeme dolaska
                    (actual_arrival); planirano ostaje u `arrival`. */}
                <Typography sx={{ fontWeight: 700 }}>
                  {departure.actual_arrival || departure.arrival}
                </Typography>
              </Box>
              <Grid alignItems="flex-end" mt={1}>
                <TableContainer>
                  <Table size="small" aria-label="a dense table">
                    <TableHead>
                      <TableRow>
                        <TableCell align="center">PUTNICI</TableCell>
                        <TableCell align="center">KAVEZI</TableCell>
                        <TableCell align="center">BICIKLI</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow
                        sx={{
                          "&:last-child td, &:last-child th": { border: 0 },
                        }}
                      >
                        <TableCell align="center" component="th" scope="row">
                          {capacity({ type: "passanger_free", id: departure })}
                        </TableCell>
                        <TableCell align="center">
                          {capacity({ type: "pets_free", id: departure })}
                        </TableCell>
                        <TableCell align="center">
                          {capacity({ type: "bicycle_free", id: departure })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Paper>
          </Button>
        ))}
      </Box>
    </>
    )
}