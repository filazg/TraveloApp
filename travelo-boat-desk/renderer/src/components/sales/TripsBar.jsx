import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { Box, Button, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";



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


    return(
        <>
      <Box
        sx={{
          width: 420,
          height: 535,
          overflow: "auto",
        }}
      >
        {appData.searchData?.harborsForSelectedDeparture?.map((departure) => (
          <Button
            key={departure.id}
            sx={{ width: 420 }}
            onClick={() => {
              handleSelectTrip(departure);
            }}
          >
            <Paper
              sx={{
                width: 420,
                //backgroundColor:
               //   selectedSalesRoute.selectedSalesRoute &&
                //  departure.id === selectedSalesRoute.selectedSalesRoute.id
                //</Button>    ? "#C7C8CC"
                //    : "",
              }}
            >
              <Grid mt={2}>
                <Typography>
                  {departure.arrival_harbor_name} / {departure.arrival}
                </Typography>
              </Grid>
              <Grid alignItems="flex-end" mt={2}>
                <TableContainer>
                  <Table size="small" aria-label="a dense table">
                    <TableHead>
                      <TableRow>
                        <TableCell align="right">PUTNICI</TableCell>
                        <TableCell align="right">KAVEZI</TableCell>
                        <TableCell align="right">BICIKLI</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow
                        sx={{
                          "&:last-child td, &:last-child th": { border: 0 },
                        }}
                      >
                        <TableCell align="right" component="th" scope="row">
                          {capacity({ type: "passanger_free", id: departure })}
                        </TableCell>
                        <TableCell align="right">
                          {capacity({ type: "pets_free", id: departure })}
                        </TableCell>
                        <TableCell align="right">
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