import { Box, Button, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import ReturnTicketModal from "./ReturnTicketModal";
import IslandReturnFromCart from "./IslandReturnFromCart";


export default function SelectedTicketsBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    // Stavka za koju se otvara povratna karta. Drzi se ovdje, a ne u redux
    // registru modala, jer prozor treba znati tocno na koju je stavku
    // kliknuto — luke, vrste karata i kolicine citaju se iz nje.
    const [povratnaZa, setPovratnaZa] = useState(null);
    // Otočna stavka traži zaseban tok (ponovno očitavanje iskaznice + svježa
    // provjera prava), pa se drži odvojeno od obične povratne.
    const [povratnaOtocnaZa, setPovratnaOtocnaZa] = useState(null);

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
            // Grupira se po tipu karte, ali povlastene karte i po iskaznici:
            // dvije razlicite iskaznice istog tipa inace zavrse u jednoj grupi i
            // obje karte ponesu podatke prve — u dojavi SEOP-u bi druga karta
            // glasila na tudju iskaznicu. Za obicne karte kljuc ostaje isti kao
            // prije, pa se nista ne mijenja.
            //
            // Pratnja (MOSI) ima isti tip I istu iskaznicu kao nositelj, pa bi bez
            // zasebne oznake pala u istu grupu i izgubila svoj naziv „— pratnja",
            // oznaku pratnje i besplatnu cijenu (nositeljeva bi se prepisala na obje).
            const kljucTipa = (t) =>
                `${t.ticket_type_uuid}|${t.povlastica?.identifikator?.vrijednost || ''}|${t.povlastica?.pratnja ? 'pratnja' : ''}`;
            const uniqueTicketType = ticeketsForRoute.filter(
                (v, i, a) => a.findIndex((t) => kljucTipa(t) === kljucTipa(v)) === i
            );
            let ticketsGroupTicketType = [];
            for (const ticketType of uniqueTicketType) {
                console.log('OVO JE TICKET TYPE', ticketType)
                const ticketsType = ticeketsForRoute.filter(
                (ticket) => kljucTipa(ticket) === kljucTipa(ticketType)
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
                card_data:ticketType.card_data,
                // Odluka posluzitelja o povlastici. Ovdje se stavke prepisuju
                // polje po polje, pa sve sto se ne navede tiho nestane — blok je
                // tako ispadao iz prodaje i karta je na posluzitelju zavrsavala
                // bez ijednog SEOP podatka.
                povlastica: ticketType.povlastica || null
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
          // Razmak do ruba stupca daje ColumnPanel; vlastiti padding bi se
          // zbrajao pa bi kartice bile uvučenije nego u Odredištima.
          width: "100%",
        }}
      >
        {appData.saleData?.addedTicketsGroups ? (
          <>
            {appData.saleData.addedTicketsGroups.map((row) => (
              <Paper
                key={row.sales_route_uuid}
                variant="accent"
                sx={{
                  my: 1,
                  p: 1.5,
                }}
              >
                <>
                  {/* Relacija lijevo, vrijeme desno, oboje podebljano — isti
                      obrazac kao kartice u Odredištima i Kartama. Prije je sve
                      stajalo u jednom h3, a gumb UKLONI zauzimao cijeli redak
                      iznad. */}
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={1}
                  >
                    {/* Velikim slovima kao nazivi luka u Odredištima, koji ih
                        dobivaju od Buttona. */}
                    <Typography sx={{ fontWeight: 700, textTransform: "uppercase" }}>
                      {row.departure_harbor_name} – {row.arrival_harbor_name}
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {row.departure}
                    </Typography>
                  </Box>

                  <Grid alignItems="flex-end">
                    {/* Bijela unutar plave kartice — da se razrada karata
                        odvoji od stavke, a ne stopi s njom. */}
                    <TableContainer component={Paper} variant="outlined" sx={{ my: 1, px: 1.5, py: 0.5 }}>
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

                  {/* Uklanjanje stavke je sporedna radnja — mali gumb u dnu
                      desno, umjesto pune širine iznad naslova. */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    {/* Povratak se nudi uz stavku jer se iz nje sve i izvodi:
                        relacija u suprotnom smjeru, vrste karata i kolicine.
                        Otočne (povlaštene) karte idu zasebnim tokom jer traže
                        iskaznicu i svježu provjeru prava. */}
                    {row.ticketsData?.some((t) => t.povlastica) ? (
                      <Button
                        color="primary"
                        size="small"
                        startIcon={<SwapHorizIcon />}
                        onClick={() => setPovratnaOtocnaZa(row)}
                      >
                        POVRATNA (OTOČNA)
                      </Button>
                    ) : (
                      <Button
                        color="primary"
                        size="small"
                        startIcon={<SwapHorizIcon />}
                        onClick={() => setPovratnaZa(row)}
                      >
                        POVRATNA
                      </Button>
                    )}
                    <Button
                      color="error"
                      size="small"
                      onClick={(e) => handleRemove(e, row)}
                    >
                      UKLONI
                    </Button>
                  </Box>
                </>
              </Paper>
            ))}
          </>
        ) : ''}



      </Grid>

      {povratnaZa ? (
        <ReturnTicketModal stavka={povratnaZa} onClose={() => setPovratnaZa(null)} />
      ) : null}

      {povratnaOtocnaZa ? (
        <IslandReturnFromCart stavka={povratnaOtocnaZa} onClose={() => setPovratnaOtocnaZa(null)} />
      ) : null}
    </>
    )
}