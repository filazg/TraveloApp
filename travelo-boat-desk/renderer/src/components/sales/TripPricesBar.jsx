import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { allAppData, setStateData } from "../../store/appSlice";
import { Box, Button, ButtonGroup, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableRow, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

export default function TripPricesBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    // Rucni unos kolicine. Tipkama + i - do 50 karata treba pedeset klikova, pa
    // se klikom na brojku otvara polje za upis. Drzi se vrsta karte koja se
    // upravo upisuje i ono sto je utipkano, jer polje mora podnijeti i prazno
    // stanje dok blagajnik brise staru vrijednost.
    const [uredjujeSe, setUredjujeSe] = useState(null);
    const [upisano, setUpisano] = useState("");

    // Otočne karte (is_island === true) ne idu u redovnu listu — kupuju se kroz
    // POVLAŠTENE KARTICE modal jer zahtijevaju otočnu iskaznicu.
    const pricesToShow = appData.searchData?.selectedTripPrices?.filter((price)=> price.is_island !== true)

    // Kolicina koja se prikazuje je ona koja je VEC u kosarici. Prije se
    // brojalo u zasebnom stanju pa se gumbom prebacivalo, zbog cega je ista
    // karta na dva mjesta znala pokazivati razlicit broj. Sada je kosarica
    // jedini izvor istine, a +/- i rucni unos pisu ravno u nju.
    const rutaZaPrice = (price) => {
      const brojac = appData.searchData?.ticketsCounter?.find(
        (c) => c.data?.ticket_type_uuid === price.ticket_type_uuid
      );
      return brojac?.sales_route || appData.searchData?.selectedTrip || null;
    };

    // Kosarica drzi i povlastene karte; njih se ovdje ne dira jer svaka nosi
    // svoju iskaznicu i mijenja se kroz svoj modal.
    const stavkaUKosarici = (price) => {
      const ruta = rutaZaPrice(price);
      if (!ruta?.uuid) return null;
      return (appData.saleData?.addedTickets || []).find(
        (t) => t.sales_route_uuid === ruta.uuid
          && t.ticket_type_uuid === price.ticket_type_uuid
          && !t.povlastica
      ) || null;
    };

    const showQuantity = (price) => stavkaUKosarici(price)?.quantity || 0;

    // Gornja granica je zastita od omaske u tipkanju; stvarni kapacitet polaska
    // provjerava posluzitelj pri rezervaciji.
    const postaviKolicinu = (price, novaKolicina) => {
      const ruta = rutaZaPrice(price);
      if (!ruta?.uuid) return;
      const broj = Math.max(0, Math.min(999, parseInt(novaKolicina, 10) || 0));
      const sve = appData.saleData?.addedTickets || [];
      const jeIsta = (t) => t.sales_route_uuid === ruta.uuid
        && t.ticket_type_uuid === price.ticket_type_uuid
        && !t.povlastica;
      const postojeca = sve.find(jeIsta);

      if (broj === 0) {
        dispatch(setStateData({ path: 'saleData/addedTickets', value: sve.filter((t) => !jeIsta(t)) }));
        return;
      }

      // Sifre karata se ne rade iznova pri svakoj promjeni: vec dodane zadrze
      // svoju, a visak se odreze. Inace bi ispravak kolicine promijenio oznaku
      // karte koja je blagajniku vec na ekranu.
      const tickets = (postojeca?.tickets || []).slice(0, broj);
      while (tickets.length < broj) tickets.push({ uuid: uuid(), code: uuid() });

      const stavka = {
        ...(postojeca || {}),
        id: postojeca?.id ?? sve.length + 1,
        sales_route_uuid: ruta.uuid,
        line_code: ruta.line_code,
        line_name: ruta.line_name,
        departure: ruta.departure,
        departure_harbor_id: ruta.departure_harbor_id,
        departure_harbor_name: ruta.departure_harbor_name,
        arrival: ruta.arrival,
        arrival_harbor_id: ruta.arrival_harbor_id,
        arrival_harbor_name: ruta.arrival_harbor_name,
        ticket_type_name: price.ticket_type_name,
        ticket_type_id: price.ticket_type_id,
        ticket_type_uuid: price.ticket_type_uuid,
        ticket_group_uuid: postojeca?.ticket_group_uuid || uuid(),
        single_price: price.price,
        // Jedinicni iznosi se pamte da ih kosarica moze preračunati pri
        // izmjeni kolicine, bez dijeljenja zbroja (koje zna odlutati u lipi).
        unit_vat_base: price.vat_base,
        unit_vat: price.vat_amount,
        unit_harbor_tax: price.port_tax,
        total_price: price.price * broj,
        total_vat_base: price.vat_base * broj,
        total_vat: price.vat_amount * broj,
        total_harbor_tax: price.port_tax * broj,
        quantity: broj,
        tickets,
      };

      dispatch(setStateData({
        path: 'saleData/addedTickets',
        value: postojeca ? sve.map((t) => (jeIsta(t) ? stavka : t)) : [...sve, stavka],
      }));
    };

    const handlePlus = (e, price) => postaviKolicinu(price, showQuantity(price) + 1);
    const handleMinus = (e, price) => postaviKolicinu(price, showQuantity(price) - 1);

    const upisiKolicinu = (price, tekst) => postaviKolicinu(price, tekst);

    const zavrsiUnos = (price) => {
      upisiKolicinu(price, upisano);
      setUredjujeSe(null);
      setUpisano("");
    };

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

                                          {uredjujeSe === price.ticket_type_uuid ? (
                                            <TextField
                                              autoFocus
                                              value={upisano}
                                              onChange={(e) => setUpisano(e.target.value.replace(/[^0-9]/g, ""))}
                                              onFocus={(e) => e.target.select()}
                                              onBlur={() => zavrsiUnos(price)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") { zavrsiUnos(price); }
                                                // Escape vraca staro stanje: blagajnik koji je
                                                // promasio brojku ne smije ostati bez kolicine.
                                                if (e.key === "Escape") { setUredjujeSe(null); setUpisano(""); }
                                              }}
                                              inputProps={{
                                                inputMode: "numeric",
                                                style: { textAlign: "center", fontSize: "1.5rem", height: 65, padding: 0 },
                                              }}
                                              sx={{
                                                width: 160,
                                                "& .MuiOutlinedInput-root": { height: 65, borderRadius: 0 },
                                              }}
                                            />
                                          ) : (
                                            <Button
                                              variant="outlined"
                                              color="primary"
                                              onClick={() => {
                                                setUredjujeSe(price.ticket_type_uuid);
                                                setUpisano(String(showQuantity(price) || ""));
                                              }}
                                              title="Klik za ručni unos količine"
                                              sx={{
                                                gridArea: "one1",
                                                height: 65,
                                                width: 160,
                                                fontSize: "1.5rem",
                                              }}
                                            >
                                              {showQuantity(price)}
                                            </Button>
                                          )}

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
          </Grid>
        </>
      ) : (
        ""
      )}
    </>
  );
}