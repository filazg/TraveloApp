import { Fragment, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Button,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useT } from "../../../i18n/useT";
import { resetTripData, resetWebSalesData, setStatus, setWebSalesData, updateTicketsCounter, webSalesDataSlice } from "../../webSalesSlice";
import { HeaderTicketNum } from "../../../components/Headers";

export default function SelectTicketsComponent (){
    const dispatch = useDispatch();
    const {t} = useT()
    const hasRun = useRef(false);
    const webSalesData = useSelector(webSalesDataSlice)
    const selectedData = webSalesData.selectedData
    const salesData = webSalesData.salesData

    const handleCancel = () => {
        dispatch(setStatus({ path: "selectTicketType", value: false }));
        dispatch(resetTripData());
    }

    let categoryPricesToShow = [];

    // Otočna cijena s polazka — propagira se na sve odabrane karte za kasniju
    // primjenu SEOP popusta u summary panelu. Uzima se prva is_island cijena
    // (otočne kategorije imaju jednu jedinstvenu cijenu po polasku).
    const islandPriceRow = (selectedData.selectedTrip.prices || []).find((p) => p.is_island === true);
    const islandUnitPrice = islandPriceRow ? Number(islandPriceRow.price) : null;
    const islandSeopType = islandPriceRow?.seop_type || null;

    const priceForTrips = () => {
      // Otočne karte se ne nude u dropdownu — pojavljuju se samo kao osnovica
      // popusta u summary panelu kad korisnik dokaže pravo iskaznicom.
      const visiblePrices = (selectedData.selectedTrip.prices || []).filter((p) => p.is_island !== true);
      for (const categoryPriceNew of visiblePrices) {
        const categoryPriceNewFinal = {
            firstPrice: Number(categoryPriceNew.price),
            firstPriceVatBase: Number(categoryPriceNew.vat_base),
            firstPriceVat: Number(categoryPriceNew.vat),
            firstPriceHarborTax: Number(categoryPriceNew.harbor_tax),
            secondPrice: 0,
            secondPriceVatBase: 0,
            secondPriceVat: 0,
            secondPriceHarborTax: 0,
            priceId: categoryPriceNew.id,
            ticket_type_name: categoryPriceNew.ticket_type_name,
            ticket_type_uuid: categoryPriceNew.ticket_type_uuid,
            description: categoryPriceNew.description,
            price: Number(categoryPriceNew.price),
            seop_type: categoryPriceNew.seop_type || null,
        };
        categoryPricesToShow = [...categoryPricesToShow, categoryPriceNewFinal];
      }
     };
    useEffect(()=>{
        if (hasRun.current) return;
        hasRun.current = true;

        priceForTrips();
    },[])

    const handleAddTickets = async (e) => {
    e.preventDefault();
    let tickets = [];
    let num = 0;
    for (const newTicketData of selectedData.counter) {
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
          const newTicket = {
            id: num,
            sales_route_uuid: selectedData.selectedTrip.uuid,
            line_code: selectedData.selectedTrip.line_code,
            line_name: selectedData.selectedTrip.line_name,
            departure: selectedData.selectedTrip.departure,
            departure_harbor_id: selectedData.selectedTrip.departure_harbor_id,
            departure_harbor_name: selectedData.selectedTrip.departure_harbor_name,
            arrival: selectedData.selectedTrip.arrival,
            arrival_harbor_id: selectedData.selectedTrip.arrival_harbor_id,
            arrival_harbor_name: selectedData.selectedTrip.arrival_harbor_name,
            ticket_type_name: newTicketData.data.ticket_type_name,
            ticket_type_id: newTicketData.data.ticket_type_id,
            ticket_type_uuid: newTicketData.data.ticket_type_uuid,
            ticket_group_uuid: uuid(),
            single_price: newTicketData.data.price,
            total_price: newTicketData.data.price * newTicketData.quantity,
            total_vat_base:
              newTicketData.data.vat_base * newTicketData.quantity,
            total_vat: newTicketData.data.vat * newTicketData.quantity,
            total_harbor_tax:
              newTicketData.data.harbor_tax * newTicketData.quantity,
            // Otočna osnovica popusta (cijena otočne karte iz cjenika za polazak)
            // — propagira se na sve karte tog polazka. U summaryu, kad SEOP vrati
            // pravo, panel ovu cijenu množi s (1 - popust/100).
            island_unit_price: islandUnitPrice,
            island_seop_type: islandSeopType,
            seop_type: newTicketData.data.seop_type ?? null,
            quantity: newTicketData.quantity,
            tickets: ticketsCodes,
          };
          dispatch(setWebSalesData({path:'salesData/tickets', value: [...salesData.tickets, newTicket] }));
          //tickets = [...tickets, newTicket];

        }
      }
    }

   dispatch(resetTripData());
  };

  const addInitialState = () => {
    let typeToAdd = [];
    for (const newType of categoryPricesToShow) {
      const counter = {
        id: newType.priceId,
        data: newType,
        quantity: 0,
      };
      typeToAdd = [...typeToAdd, counter];
    }
    dispatch(setWebSalesData({path:"selectedData/counter", value: typeToAdd }));
  };

  useEffect(() => {
    addInitialState();
  }, []);

  const handlePlus = (e, price) => {
    const quantity = selectedData.counter.find(
      (number) => number.data.ticket_type_uuid && number.data.ticket_type_uuid === price.ticket_type_uuid
    );
    const value = quantity.quantity + 1;
    const counter = {
      id: price.priceId,
      data: price,
      quantity: value,
    };
    dispatch(updateTicketsCounter({ path: price.priceId, value: counter }));
  };

  const handleMinus = (e, price) => {
    const quantity = selectedData.counter.find(
      (number) => number.data.ticket_type_uuid && number.data.ticket_type_uuid === price.ticket_type_uuid
    );
    let value = quantity.quantity - 1;

    if (value < 1) {
      value = 0;
    }
    const counter = {
      id: price.priceId,
      data: price,
      quantity: value,
    };
    dispatch(updateTicketsCounter({ path: price.priceId, value: counter }));
  };

  const showQuantity = (id) => {
    if (selectedData.counter.length < 1) {
      return 0;
    } else {
      const quantity = selectedData?.counter?.find(
        (number) => number.data.ticket_type_uuid && number.data.ticket_type_uuid === id
      );
      return quantity.quantity;
    }
  };

  const canSelectTicket = () => {
    const findQuantity = selectedData?.counter?.find((number) => number.quantity !== 0);
    const canSelect = [findQuantity].every(Boolean);
    if(canSelect){
        return true
    }else{
        return false
    }
  }

    return(
        <Grid>
      <Grid size={12}>
        <Grid container direction="row" mb={2}>
          <Grid size={12}>
            <Box>
              <Box display="flex" justifyContent="flex-end" alignItems="center">
                <Button color="error" onClick={handleCancel}>{t('search.ticket_select_quit')}</Button>

              </Box>
              <Box display="flex" justifyContent="center" alignItems="center">
                <HeaderTicketNum
                  title={t('search.ticket_select')}
                />
              </Box>
              <Box>
                <form >
                  <Grid container direction="column">
                    <Grid>
                      <TableContainer
                        component={Paper}
                        sx={{
                          my: 2,
                        }}
                      >
                        <Table size="small" aria-label="a dense table">

                          <TableBody>
                            {selectedData?.counter?.map((price) => (
                              <Fragment key={price.id}>
                                <TableRow
                                  className="select"
                                  key={price.id}
                                  sx={{
                                    "&:last-child td, &:last-child th": {
                                      border: 0,
                                    },
                                    border: 0
                                  }}
                                >
                                  <TableCell
                                    align="center"
                                    component="th"
                                    scope="row"
                                    colSpan={4}
                                    sx={{ border: "none" }}
                                  >
                                    {price.data.ticket_type_name}{" "}
                                    <Tooltip title={price.data.description}>
                                      <IconButton>
                                        <InfoOutlinedIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                                <TableRow
                                  sx={{ border: "none" }}
                                >
                                  <TableCell
                                    align="center"
                                    component="th"
                                    scope="row"
                                    colSpan={4}
                                  >
                                    <Stack
                                      direction="row"
                                      justifyContent="center"
                                      alignItems="center"
                                    >
                                      <Box>
                                        <Typography>
                                          {price.data.price.toFixed(2)} EUR
                                        </Typography>

                                      </Box>
                                      <Box>

                                        <ToggleButtonGroup>
                                          <ToggleButton
                                            value="minus"
                                            sx={{ height: 40, border: 'none' }}
                                            onClick={(e) => handleMinus(e, price.data)}
                                        >
                                            <RemoveIcon color="error" />
                                        </ToggleButton>
                                          <ToggleButton
                                          value=''
                                            sx={{
                                              height: 40,
                                              border: 'none'
                                            }}
                                          >
                                            <Typography
                                              variant="outlined"
                                              align="right"
                                              fontWeight='bold'
                                              sx={{
                                                width: 40,
                                                fontSize: 16
                                              }}
                                            //onChange={(e) => handleAddTicket(e, price)}
                                            >
                                              {showQuantity(price.data.ticket_type_uuid)}
                                            </Typography>
                                          </ToggleButton>
                                          <ToggleButton
                                            value="plus"
                                            sx={{ height: 40, border: 'none' }}
                                            onClick={(e) => handlePlus(e, price.data)}
                                        >
                                            <AddIcon color="success" />
                                        </ToggleButton>
                                        </ToggleButtonGroup>
                                      </Box>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              </Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                    <Grid size={12}>
                      <Button
                        variant="contained"
                        fullWidth
                        disabled={!canSelectTicket()}
                        onClick={handleAddTickets}
                        sx={{
                          height: 60,
                        }}
                      >
                        <h2>{t('search.add_tickets')}</h2>
                      </Button>
                    </Grid>

                  </Grid>
                </form>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
    )
}