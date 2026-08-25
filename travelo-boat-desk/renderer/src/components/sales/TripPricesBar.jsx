import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { allAppData, resetStateData, setStateData, updateTicketsCounter } from "../../store/appSlice";
import { Box, Button, ButtonGroup, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

export default function TripPricesBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    // Otočne karte (is_island === true) ne idu u redovnu listu — kupuju se kroz
    // POVLAŠTENE KARTICE modal jer zahtijevaju otočnu iskaznicu.
    const pricesToShow = appData.searchData?.selectedTripPrices?.filter((price)=> price.is_island !== true)

    const showQuantity = (id) => {
      if (appData.searchData?.ticketsCounter?.length < 1) {
        return 0;
      } else {
        const quantity = appData.searchData?.ticketsCounter?.find(
          (number) =>
            number.data.ticket_type_uuid && number.data.ticket_type_uuid === id
        );
        return quantity?.quantity;
      }
    };


    const handlePlus = (e, price) => {
      const quantity = appData.searchData?.ticketsCounter.find(
        (number) =>
          number.data.ticket_type_uuid &&
          number.data.ticket_type_uuid === price.ticket_type_uuid
      );
      const value = quantity.quantity + 1;
      const counter = {
        id: price.id,
        data: price,
        quantity: value,
      };
      //console.log(counter);
      dispatch(updateTicketsCounter({ path: price.id, value: counter }));
    };

    const handleMinus = (e, price) => {
      //console.log(price);
      const quantity = appData.searchData?.ticketsCounter.find(
        (number) =>
          number.data.ticket_type_uuid &&
          number.data.ticket_type_uuid === price.ticket_type_uuid
      );
      let value = quantity.quantity - 1;

      if (value < 1) {
        value = 0;
      }
      const counter = {
        id: price.id,
        data: price,
        quantity: value,
      };
      dispatch(updateTicketsCounter({ path: price.id, value: counter }));
    };

    const handleAddTickets = (e) => {
      console.log("DODAJ U KOSARICU");
      e.preventDefault();
      let ticketsToAdd = appData.saleData.addedTickets || [];
      let num = 0;
      for (const newTicketData of appData.searchData.ticketsCounter) {
      if (newTicketData) {
        if (newTicketData.quantity > 0) {
          let ticketsCodes = [];
          for (let i = 0; i < newTicketData.quantity; i++) {
            const newCode = {
              uuid: uuid(),
              code: uuid(),
            };
            ticketsCodes = [...ticketsCodes, newCode];
          }
          num++;
          console.log('NEW TICKETS', newTicketData)
          const newTicket = {
            id: num,
            sales_route_uuid: newTicketData.sales_route.uuid,
            line_code: newTicketData.sales_route.line_code,
            line_name: newTicketData.sales_route.line_name,
            departure: newTicketData.sales_route.departure,
            departure_harbor_id:newTicketData.sales_route.departure_harbor_id,
            departure_harbor_name:newTicketData.sales_route.departure_harbor_name,
            arrival: newTicketData.sales_route.arrival,
            arrival_harbor_id: newTicketData.sales_route.arrival_harbor_id,
            arrival_harbor_name:newTicketData.sales_route.arrival_harbor_name,
            ticket_type_name: newTicketData.data.ticket_type_name,
            ticket_type_id: newTicketData.data.ticket_type_id,
            ticket_type_uuid: newTicketData.data.ticket_type_uuid,
            ticket_group_uuid: uuid(),
            single_price: newTicketData.data.price,
            total_price: newTicketData.data.price * newTicketData.quantity,
            total_vat_base:newTicketData.data.vat_base * newTicketData.quantity,
            total_vat: newTicketData.data.vat_amount * newTicketData.quantity,
            total_harbor_tax:newTicketData.data.port_tax * newTicketData.quantity,
            quantity: newTicketData.quantity,
            tickets: ticketsCodes,
          };
          console.log(newTicket)
          dispatch(resetStateData({path:'searchData/selectedTrip'}))
          dispatch(resetStateData({path:'searchData/selectedTripPrices'}))
          dispatch(resetStateData({path:'searchData/ticketsCounter'}))
          ticketsToAdd = [...ticketsToAdd, newTicket];
        }
      }
    }
    dispatch(setStateData({path:'saleData/addedTickets' ,value: ticketsToAdd }));
    }

    const canSelectTickets = [
      appData.searchData?.ticketsCounter?.find((tic)=>tic.quantity > 0)
    ].every(Boolean)


    return (
    <>
      {pricesToShow ? (
        <>
          <Grid
            sx={{
              width: '100%',
              // Stupac pune visine: lista raste, gumb ispod ostaje na dnu.
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Grid
              item
              sx={{
                // Bez vlastitog paddinga — razmak do ruba stupca daje ColumnPanel,
                // inače se zbraja i kartice ispadnu uvučenije nego u Odredištima.
                fontSize: "0,875rem",
                fontWeight: "700",
                flex: 1,
                minHeight: 0,
              }}
            >
              <Grid
                item
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(1, 1fr)",
                  gap: 1,
                  gridTemplateRows: "auto",
                  gridTemplateAreas: `"one"
                        "."
                        "."
                        "two"
                        "tree"
                        "four"
                        "five"
                        "."
                        "."
                        "six"
                        `,
                }}
              >

                {pricesToShow ? (
                  <>
                    <Grid container direction="column">
                      <Grid>
                        <TableContainer
                          component={Paper}
                          variant="accent"
                          sx={{
                            my: 1,
                            p: 1.5,
                          }}
                        >
                          <Table size="small" aria-label="a dense table">
                            {pricesToShow.map((price) => (
                              <TableBody key={price.id}>
                                <TableRow
                                  className="select"
                                  sx={{
                                    "&:last-child td, &:last-child th": {
                                      border: 0,
                                    },
                                    border: 0,
                                  }}
                                >
                                  {/* Naziv lijevo, cijena desno, oboje podebljano —
                                      isto kao kartice u Odredištima. Padding
                                      tablice se poništava da tekst stoji uz rub
                                      kartice, a ne uvučen. */}
                                  <TableCell
                                    align="left"
                                    component="th"
                                    scope="row"
                                    colSpan={4}
                                    sx={{
                                      border: "none",
                                      p: 0,
                                      typography: "body1",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {price.ticket_type_name}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    component="th"
                                    scope="row"
                                    colSpan={4}
                                    sx={{
                                      border: "none",
                                      p: 0,
                                      typography: "body1",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {price.price.toFixed(2)} EUR
                                  </TableCell>
                                </TableRow>
                                <TableRow sx={{ border: "none" }}>
                                  <TableCell
                                    align="center"
                                    component="th"
                                    scope="row"
                                    colSpan={8}
                                  >
                                    <Stack
                                      direction="row"
                                      justifyContent="center"
                                      alignItems="center"
                                    >
                                      <Box>
                                        <ButtonGroup>
                                          <Button
                                            variant="outlined"
                                            color="error"
                                            onClick={(e) =>
                                              handleMinus(e, price)
                                            }
                                            sx={{
                                              gridArea: "one1",
                                              height: 65,
                                              fontSize: "1.5rem",
                                            }}
                                          >
                                            <RemoveIcon />
                                          </Button>

                                          <Button
                                            variant="outlined"
                                            color="primary"
                                            sx={{
                                              gridArea: "one1",
                                              height: 65,
                                              width: 160,
                                              fontSize: "1.5rem",
                                            }}
                                          >
                                            {showQuantity(
                                              price.ticket_type_uuid
                                            )}
                                          </Button>

                                          <Button
                                            variant="outlined"
                                            color="success"
                                            onClick={(e) =>
                                              handlePlus(e, price)
                                            }
                                            sx={{
                                              gridArea: "one1",
                                              height: 65,
                                              fontSize: "1.5rem",
                                            }}
                                          >
                                            <AddIcon />
                                          </Button>
                                        </ButtonGroup>
                                      </Box>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            ))}
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                  </>
                ) : (
                  ""
                )}
              </Grid>
            </Grid>
            {/* Gumb ostaje prikovan za dno stupca dok se lista tipova karata
                skrola iznad njega — inače bi kod duljeg cjenika ispao izvan
                vidljivog dijela i blagajnik bi ga morao tražiti skrolanjem. */}
            {/* Traka na dnu stupca — negativne margine ponište padding panela
                pa gumb ide od ruba do ruba, a donji kutovi prate zaobljenje
                kartice (borderRadius 3 = 12px). */}
            <Grid
              sx={{
                flexShrink: 0,
                mx: -1,
                mb: -1,
                mt: 1,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Button
                variant="contained"
                color="success"
                disabled={!canSelectTickets}
                sx={{
                  width: "100%",
                  height: 88,
                  borderRadius: 0,
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                  // Glavna radnja u stupcu — veći tekst od ostalih gumba.
                  fontSize: "1.25rem",
                }}
                onClick={handleAddTickets}
              >
                DODAJ ODABRANO
              </Button>
            </Grid>

          </Grid>
        </>
      ) : (
        ""
      )}
    </>
  );
}