import { Box, Button, Grid, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import ReturnTicketModal from "./ReturnTicketModal";
import SubsidisedCartModal from "./SubsidisedCartModal";


export default function SelectedTicketsBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    // Stavka za koju se otvara povratna karta. Drzi se ovdje, a ne u redux
    // registru modala, jer prozor treba znati tocno na koju je stavku
    // kliknuto — luke, vrste karata i kolicine citaju se iz nje.
    const [povratnaZa, setPovratnaZa] = useState(null);
    // Relacija ciji se popis povlastenih karata otvara.
    const [povlasteneZa, setPovlasteneZa] = useState(null);

    // Rucni ispravak kolicine u kosarici: blagajnik klikne na broj i upise novi.
    // Prije se to moglo samo u sekciji karata, pa je ispravak zahtijevao
    // uklanjanje cijele stavke i ponovni odabir.
    const [uredjujeSe, setUredjujeSe] = useState(null);
    const [upisano, setUpisano] = useState("");

    // Povlastena karta nosi svoju iskaznicu i pravo provjereno za tocno jednu
    // osobu, pa joj se kolicina ovdje ne dira — mijenja se kroz svoj modal.
    const smijeSeMijenjati = (ticket) => !ticket.povlastica;

    const kljucRetka = (row, ticket) => `${row.sales_route_uuid}|${ticket.ticket_type_uuid}`;

    // Naziv koji se pokazuje za povlastenu kartu. Dosad je ondje stajalo golo
    // "SEOP"/"MOSI" — oznaka sustava, ne ono sto putnik kupuje. Ured sada uz
    // sifru prava upisuje naziv (Integracije -> AKD -> SEOP -> Popusti) i on
    // ima prednost; bez upisanog naziva ostaje kako je bilo.
    // Povlastene se u kosarici pokazuju kao JEDAN redak. Prije je svaka
    // iskaznica imala svoj, pa je kod grupe putnika kosarica narasla toliko da
    // se obicne karte vise nisu vidjele — a razlika medu tim redcima (pravo,
    // otok, popust) ionako se ne vidi bez razrade. Razrada je u modalu.
    const obicneKarte = (row) => (row.ticketsData || []).filter((t) => !t.povlastica);
    const povlasteneKarte = (row) => (row.ticketsData || []).filter((t) => t.povlastica);

    const zbrojPovlastenih = (row) => povlasteneKarte(row).reduce(
        (z, t) => ({
            kolicina: z.kolicina + (Number(t.quantity) || 0),
            iznos: z.iznos + (Number(t.total_price) || 0),
        }),
        { kolicina: 0, iznos: 0 }
    );

    const nazivKarte = (ticket) => {
        const pravo = String(ticket.povlastica?.pravo || "").trim();
        if (!pravo) return ticket.ticket_type_name;
        const upis = (appData.basicData?.seop_right_discounts || [])
            .find((r) => String(r.code || "").trim() === pravo);
        return upis?.ticket_label || ticket.ticket_type_name;
    };

    const postaviKolicinu = (row, ticket, tekst) => {
        const broj = Math.max(0, Math.min(999, parseInt(tekst, 10) || 0));
        const sve = appData.saleData?.addedTickets || [];
        const jeIsta = (t) => t.sales_route_uuid === row.sales_route_uuid
            && t.ticket_type_uuid === ticket.ticket_type_uuid
            && !t.povlastica;
        const postojeca = sve.find(jeIsta);
        if (!postojeca) return;

        if (broj === 0) {
            dispatch(setStateData({ path: 'saleData/addedTickets', value: sve.filter((t) => !jeIsta(t)) }));
            return;
        }

        // Sifre vec dodanih karata ostaju iste, visak se odreze.
        const tickets = (postojeca.tickets || []).slice(0, broj);
        while (tickets.length < broj) tickets.push({ uuid: uuid(), code: uuid() });

        // Jedinicni iznosi se citaju s naljepnice stavke; starije stavke ih
        // nemaju, pa se tada izvedu iz zbroja.
        const kol = postojeca.quantity || 1;
        const jedVatBase = postojeca.unit_vat_base ?? (Number(postojeca.total_vat_base) || 0) / kol;
        const jedVat = postojeca.unit_vat ?? (Number(postojeca.total_vat) || 0) / kol;
        const jedTaksa = postojeca.unit_harbor_tax ?? (Number(postojeca.total_harbor_tax) || 0) / kol;

        const stavka = {
            ...postojeca,
            quantity: broj,
            tickets,
            total_price: Number(postojeca.single_price) * broj,
            total_vat_base: jedVatBase * broj,
            total_vat: jedVat * broj,
            total_harbor_tax: jedTaksa * broj,
        };
        dispatch(setStateData({
            path: 'saleData/addedTickets',
            value: sve.map((t) => (jeIsta(t) ? stavka : t)),
        }));
    };

    // Uklanjanje JEDNOG retka. Redak je vrsta karte na toj relaciji, a kod
    // povlastenih i konkretna iskaznica — isti kljuc po kojem se stavke i
    // grupiraju, inace bi se uklonila i tuda karta istog tipa.
    const kljucTipaStavke = (t) =>
        `${t.ticket_type_uuid}|${t.povlastica?.identifikator?.vrijednost || ''}|${t.povlastica?.pratnja ? 'pratnja' : ''}`;

    const ukloniRedak = (row, ticket) => {
        const kljuc = kljucTipaStavke(ticket);
        const iskaznica = ticket.povlastica?.identifikator?.vrijednost || null;
        // Pratnja (MOSI) postoji samo uz nositelja kartice i besplatna je. Kad
        // se makne nositelj, mora otici i ona — inace u kosarici ostane
        // besplatna karta bez osobe uz koju ide.
        const nositeljSPratnjom = iskaznica && ticket.povlastica && !ticket.povlastica.pratnja;

        const preostale = (appData.saleData?.addedTickets || []).filter((t) => {
            if (t.sales_route_uuid !== row.sales_route_uuid) return true;
            if (kljucTipaStavke(t) === kljuc) return false;
            if (nositeljSPratnjom
                && t.povlastica?.pratnja
                && t.povlastica?.identifikator?.vrijednost === iskaznica) return false;
            return true;
        });
        dispatch(setStateData({ path: 'saleData/addedTickets', value: preostale }));
    };

    const zavrsiUnos = (row, ticket) => {
        postaviKolicinu(row, ticket, upisano);
        setUredjujeSe(null);
        setUpisano("");
    };

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
                      {/* `tableLayout: fixed` — bez toga preglednik sirine racuna
                          iz sadrzaja, pa svaka relacija dobije svoje i stupci
                          medu karticama ne stoje jedan ispod drugoga. Sirine se
                          zadaju jednom, u zaglavlju. */}
                      <Table size="small" aria-label="a dense table" sx={{ tableLayout: 'fixed', width: '100%' }}>
                        <TableHead>
                          <TableRow>
                            {/* Naziv uzima sav preostali prostor, brojcani
                                stupci imaju svoje sirine — inace se pri duzem
                                iznosu (veca kolicina) stupci pomicu iz retka
                                u redak. */}
                            <TableCell sx={{ width: 'auto' }}>
                              tip karte
                            </TableCell>
                            <TableCell align="right" sx={{ width: 64, whiteSpace: 'nowrap' }}>
                              kol
                            </TableCell>
                            {/* Na uskom zaslonu se cijena skriva. Mora biti
                                `table-cell`, ne `block`: blok izlazi iz retka
                                tablice i razbija poravnanje ostalih stupaca. */}
                            <TableCell align="right"
                              sx={{
                                display: { xs: 'none', sm: 'table-cell' },
                                width: 96,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              cijena
                            </TableCell>
                            <TableCell align="right" sx={{ width: 110, whiteSpace: 'nowrap' }}>
                              iznos
                            </TableCell>
                            <TableCell align="right" sx={{ width: 36, p: 0 }} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {obicneKarte(row).map((ticket) => (
                            <TableRow
                              key={ticket.ticket_uuid}
                              sx={{
                                "&:last-child td, &:last-child th": {
                                  border: 0,
                                },
                              }}
                            >
                              <TableCell component="th" scope="row" sx={{ wordBreak: 'break-word' }}>
                                {nazivKarte(ticket)}
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {uredjujeSe === kljucRetka(row, ticket) ? (
                                  <TextField
                                    autoFocus
                                    size="small"
                                    variant="standard"
                                    value={upisano}
                                    onChange={(e) => setUpisano(e.target.value.replace(/[^0-9]/g, ""))}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={() => zavrsiUnos(row, ticket)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { zavrsiUnos(row, ticket); }
                                      // Escape vraca staro stanje: promasena brojka
                                      // ne smije ostaviti stavku bez kolicine.
                                      if (e.key === "Escape") { setUredjujeSe(null); setUpisano(""); }
                                    }}
                                    inputProps={{ inputMode: "numeric", style: { textAlign: "right", width: 40, padding: 0 } }}
                                  />
                                ) : smijeSeMijenjati(ticket) ? (
                                  <Box
                                    onClick={() => {
                                      setUredjujeSe(kljucRetka(row, ticket));
                                      setUpisano(String(ticket.quantity || ""));
                                    }}
                                    title="Klik za izmjenu kolicine"
                                    sx={{
                                      cursor: "pointer",
                                      display: "inline-block",
                                      minWidth: 32,
                                      px: 0.5,
                                      borderRadius: 1,
                                      textDecoration: "underline dotted",
                                      "&:hover": { bgcolor: "action.hover" },
                                    }}
                                  >
                                    {ticket.quantity}
                                  </Box>
                                ) : (
                                  ticket.quantity
                                )}
                              </TableCell>
                              <TableCell align="right"
                                sx={{
                                  display: { xs: 'none', sm: 'table-cell' },
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {Number(ticket.single_price).toFixed(2)} EUR
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {Number(ticket.total_price).toFixed(2)} EUR
                              </TableCell>
                              {/* Uklanjanje retka je sporedna radnja — mala
                                  ikona uz rub, da ne odvlaci od iznosa. */}
                              <TableCell align="right" sx={{ p: 0 }}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => ukloniRedak(row, ticket)}
                                  title="Ukloni ovu vrstu karte"
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}

                          {/* Zbirni redak povlastenih. Cijena se ne prikazuje
                              jer se po kartama razlikuje (svaka nosi svoje
                              pravo i popust) — jedan iznos ondje bio bi
                              netocan, a prosjek besmislen. */}
                          {povlasteneKarte(row).length > 0 && (() => {
                            const zbroj = zbrojPovlastenih(row);
                            return (
                              <TableRow>
                                <TableCell component="th" scope="row" sx={{ wordBreak: 'break-word' }}>
                                  Povlaštene
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                  {zbroj.kolicina}
                                </TableCell>
                                <TableCell align="right"
                                  sx={{
                                    display: { xs: 'none', sm: 'table-cell' },
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <Typography variant="body2" color="text.secondary">—</Typography>
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                  {zbroj.iznos.toFixed(2)} EUR
                                </TableCell>
                                <TableCell align="right" sx={{ p: 0 }}>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => setPovlasteneZa(row)}
                                    title="Razrada povlaštenih karata"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })()}

                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  {/* Uklanjanje stavke je sporedna radnja — mali gumb u dnu
                      desno, umjesto pune širine iznad naslova. */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    {/* Povratak se nudi uz stavku jer se iz nje sve i izvodi:
                        relacija u suprotnom smjeru, vrste karata i kolicine.
                        Obicne i otocne (povlastene) idu kroz isti modal. */}
                    <Button
                      color="primary"
                      size="small"
                      startIcon={<SwapHorizIcon />}
                      onClick={() => setPovratnaZa(row)}
                    >
                      POVRATNA
                    </Button>
                    <Button
                      color="error"
                      size="small"
                      onClick={(e) => handleRemove(e, row)}
                    >
                      UKLONI SVE
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

      {povlasteneZa ? (
        <SubsidisedCartModal stavka={povlasteneZa} onClose={() => setPovlasteneZa(null)} />
      ) : null}
    </>
    )
}