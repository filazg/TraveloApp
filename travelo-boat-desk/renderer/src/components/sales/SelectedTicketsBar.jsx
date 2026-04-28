import { Box, Button, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { useEffect } from "react";
import { v4 as uuid } from "uuid";


export default function SelectedTicketsBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    const createTicketsGroup = async () => {
      //await dispatch(setStateData({path:'status', value:'loading'}))
        let ticketsGroup = []
        const uniqueSalesRoute = appData.saleData?.addedTickets?.filter(
            (v, i, a) =>a.findIndex((t) => t.sales_route_uuid === v.sales_route_uuid) === i
        );
        if(uniqueSalesRoute){

        
        for (const salesRoute of uniqueSalesRoute) {
            const ticeketsForRoute = appData.saleData.addedTickets.filter(
                (ticket) => ticket.sales_route_uuid === salesRoute.sales_route_uuid
            );
            const uniqueTicketType = ticeketsForRoute.filter(
                (v, i, a) =>
                a.findIndex((t) => t.ticket_type_uuid === v.ticket_type_uuid) === i
            );
            let ticketsGroupTicketType = [];
            for (const ticketType of uniqueTicketType) {
                console.log('OVO JE TICKET TYPE', ticketType)
                const ticketsType = ticeketsForRoute.filter(
                (ticket) => ticket.ticket_type_uuid === ticketType.ticket_type_uuid
                );
                const subtotalTotalPrice = ticketsType
                .map(({ total_price }) => total_price)
                .reduce((sum, i) => sum + i, 0);
                const subtotalVAtBAse = ticketsType
                .map(({ total_vat_base }) => total_vat_base)
                .reduce((sum, i) => sum + i, 0);
                const subtotalVat = ticketsType
                .map(({ total_vat }) => total_vat)
                .reduce((sum, i) => sum + i, 0);
                const subtotalHarborTax = ticketsType
                .map(({ total_harbor_tax }) => total_harbor_tax)
                .reduce((sum, i) => sum + i, 0);
                const subtotalQuantity = ticketsType
                .map(({ quantity }) => quantity)
                .reduce((sum, i) => sum + i, 0);
                const addTicketsGroupTicketType = {
                ticket_uuid: uuid(),
                ticket_type_name: ticketType.ticket_type_name,
                ticket_type_id: ticketType.ticket_type_id,
                ticket_type_uuid: ticketType.ticket_type_uuid,
                single_price: Number(ticketType.single_price.toFixed(2)),
                total_price: Number(subtotalTotalPrice.toFixed(2)),
                total_vat_base: Number(subtotalVAtBAse.toFixed(2)),
                total_vat: Number(subtotalVat.toFixed(2)),
                total_harbor_tax: Number(subtotalHarborTax.toFixed(2)),
                quantity: subtotalQuantity,
                card_data:ticketType.card_data
                };
                ticketsGroupTicketType = [...ticketsGroupTicketType, addTicketsGroupTicketType];
            }
            const ticketItemPrice = ticketsGroupTicketType
                .map(({ total_price }) => Number(total_price))
                .reduce((sum, i) => sum + i, 0);
            const ticketItemVatBase = ticketsGroupTicketType
                .map(({ total_vat_base }) => Number(total_vat_base))
                .reduce((sum, i) => sum + i, 0);
            const ticketItemVat = ticketsGroupTicketType
                .map(({ total_vat }) => Number(total_vat))
                .reduce((sum, i) => sum + i, 0);
            const ticketItemHarborTax = ticketsGroupTicketType
                .map(({ total_harbor_tax }) => Number(total_harbor_tax))
                .reduce((sum, i) => sum + i, 0);
            const addTicketsGroup = {
                sales_route_uuid: salesRoute.sales_route_uuid,
                line_code: salesRoute.line_code,
                line_name: salesRoute.line_name,
                departure: salesRoute.departure,
                departure_harbor_id: salesRoute.departure_harbor_id,
                departure_harbor_name: salesRoute.departure_harbor_name,
                arrival: salesRoute.arrival,
                arrival_harbor_id: salesRoute.arrival_harbor_id,
                arrival_harbor_name: salesRoute.arrival_harbor_name,
                //ticket_single_price:Number(ticketType.single_price.toFixed(2)),
                ticket_item_price: ticketItemPrice.toFixed(2),
                ticket_item_vat_base: ticketItemVatBase.toFixed(2),
                ticket_item_vat: ticketItemVat.toFixed(2),
                ticket_item_harbor_tax: ticketItemHarborTax.toFixed(2),
                ticketsData: ticketsGroupTicketType,
            };
            ticketsGroup = [...ticketsGroup, addTicketsGroup];
            }
            console.log(ticketsGroup)
            dispatch(setStateData({path:'saleData/addedTicketsGroups',value:ticketsGroup}))
        }
        //await dispatch(setStateData({path:'status', value:'ready'}))
    }

    const handleRemove = (e, row) => {
        const filteredTickets = appData.saleData.addedTickets.filter(
        (ticket) => ticket.sales_route_uuid !== row.sales_route_uuid
        );
        dispatch(setStateData({path:'saleData/addedTickets', value: filteredTickets }));
    };

    useEffect(() => {
        //console.log(ticketsData)
        createTicketsGroup()
    }, [appData.saleData?.addedTickets])
    useEffect(() => {
        console.log('KARTE SU', appData.saleData?.addedTicketsGroups)
    }, [appData.saleData?.addedTicketsGroups])

    return (
        <>
      <Grid
        sx={{
          p: 1,
          width: 410,
          height: "100%",
          overflow: "auto",
        }}
      >
        {appData.saleData?.addedTicketsGroups ? (
          <>
            {appData.saleData.addedTicketsGroups.map((row) => (
              <Box
                key={row.sales_route_uuid}
                alignItems="flex-end"
                fullwidth="true"
                sx={{
                  bgcolor: "background.paper",
                  boxShadow: 2,
                  borderRadius: 2,
                  mb: 2,
                  p: (0, 2, 2, 2),
                }}
              >
                <>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >


                    <Button
                      color="error"
                      onClick={(e) => handleRemove(e, row)}
                    >
                      UKLONI
                    </Button>
                  </Box>
                  <Grid>
                    <h3>
                      {row.departure_harbor_name} -- {row.arrival_harbor_name} / {row.departure}
                    </h3>
                  </Grid>

                  <Grid alignItems="flex-end">
                    <TableContainer component={Paper}>
                      <Table size="small" aria-label="a dense table">
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              tip karte
                            </TableCell>
                            <TableCell align="right">
                              kol
                            </TableCell>
                            <TableCell align="right"
                              sx={{
                                display: { xs: 'none', sm: 'block' }
                              }}
                            >
                              cijena
                            </TableCell>
                            <TableCell align="right">
                              iznos
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {row.ticketsData.map((ticket) => (
                            <TableRow
                              key={ticket.ticket_uuid}
                              sx={{
                                "&:last-child td, &:last-child th": {
                                  border: 0,
                                },
                              }}
                            >
                              <TableCell component="th" scope="row">
                                {ticket.ticket_type_name}
                              </TableCell>
                              <TableCell align="right">
                                {ticket.quantity}
                              </TableCell>
                              <TableCell align="right"
                                sx={{
                                  display: { xs: 'none', sm: 'block' }
                                }}
                              >
                                {ticket.single_price} EUR
                              </TableCell>
                              <TableCell align="right">
                                {ticket.total_price} EUR
                              </TableCell>
                            </TableRow>
                          ))}

                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </>
              </Box>
            ))}
          </>
        ) : ''}



      </Grid>
    </>
    )
}