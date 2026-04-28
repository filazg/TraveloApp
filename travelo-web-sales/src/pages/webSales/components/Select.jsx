import {
  Box,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { setWebSalesData, webSalesDataSlice } from "../../webSalesSlice";

import { useT } from "../../../i18n/useT";
import { TitleSelectText, TitleSmall } from "../../../components/Headers";

export default function SelectComponent (){
    const dispatch = useDispatch();
    const {t} = useT()
    const webSalesData = useSelector(webSalesDataSlice)
    const searchData = webSalesData.searchData
    const selectedData = webSalesData.selectedData
    const tripsData = webSalesData.tripsData
  
    const handleSelect = (e, row) => {
        console.log(row);
        dispatch(setWebSalesData({ path: "selectedData/selectedTrip", value: row }));
    };
 
  return (
    <>
    {tripsData?.trips ? (
      <Grid container direction="row" sx={{ mt: 3 }}>
        {tripsData.trips.length ? (
          <>
            <Grid size={12}>
            <Grid >
              <TitleSmall from={searchData?.travel_from?.name} to={searchData?.travel_to?.name} />
              <TitleSelectText text1={t('search.selectText')}  />
            </Grid>
              <Grid>
                <TableContainer component={Paper}>
                  <Table aria-label="a dense table">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('search.departure')}</TableCell>
                        <TableCell>{t('search.arrival')}</TableCell>
                        
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tripsData.trips.map((row) => (
                        <TableRow
                          className='select'
                          key={row.id}
                          onClick={(e) => handleSelect(e, row)}
                          
                          selected={selectedData?.selectedTrip?.id === row.id}
                          sx={{
                            "&:last-child td, &:last-child th": { border: 0 },
                            "&:hover": { cursor: 'pointer' }
                          }}
                        >
                          <TableCell
                            component="th"
                            scope="row"
                            sx={{
                              fontWeight: 'bold',
                              color: selectedData?.selectedTrip?.id === row.id ? 'primary.main' : 'inherit',
                            }}
                          >
                          {row.actual_departure}
                          </TableCell>
                          <TableCell>{row.actual_arrival}</TableCell>
                          
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
            <Grid  size={{md:12, lg:6}} ></Grid>
          </>
        ) : (
          <Grid size={12}>
            <Box
              fullwidth="true"
              sx={{
                bgcolor: "background.paper",
                boxShadow: 1,
                borderRadius: 2,
                p: 2,
                height: 40,
              }}
            >
              {!tripsData.trips.length ? t('search.no_departures') : ''}
            </Box>
          </Grid>
        )}
        <Grid size={12} sx={{mt:2}}>
          
        </Grid>
      </Grid>
      ) : ''}
    </>
  );
};
