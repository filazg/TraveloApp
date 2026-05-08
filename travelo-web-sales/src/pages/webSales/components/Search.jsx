import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DesktopDatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { Autocomplete, Box, Grid, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import logo from "../../../assets/LOGO.png";
import { useT } from "../../../i18n/useT";
import { postDataThunk, setGlobalLoading, setWebSalesData, webSalesDataSlice } from "../../webSalesSlice";
import { Title } from "../../../components/Headers";

export default function SearchComponent (){
    const dispatch = useDispatch()
    const webSalesData = useSelector(webSalesDataSlice)
    const tripData = webSalesData.tripData
    const searchData = webSalesData.searchData
    const travelDate = searchData.travel_date

    const {t} = useT()

    const [firstDay, setFirstDay] = useState(new Date());

    let d = new Date(firstDay);
    const d1 = new Date(d);
    const d2 = new Date(d);
    const d3 = new Date(d);
    const d4 = new Date(d);
    const d5 = new Date(d);
    const d6 = new Date(d);
    d1.toLocaleDateString();
    d2.setDate(d.getDate() + 1);
    d2.toLocaleDateString();
    d3.setDate(d.getDate() + 2);
    d3.toLocaleDateString();
    d4.setDate(d.getDate() + 3);
    d4.toLocaleDateString();
    d5.setDate(d.getDate() + 4);
    d5.toLocaleDateString();
    d6.setDate(d.getDate() + 5);
    d6.toLocaleDateString();

    let days = {
        en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        hr: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"],
    };

    let dtoswow = d1;

    const filteredHarborsTo = webSalesData?.transportData?.harbors.filter(
        (harbor) => harbor?.id !== webSalesData?.searchData?.travel_from?.id
    );
    const filteredHarborsFrom = webSalesData?.transportData?.harbors.filter(
        (harbor) => harbor.id !== webSalesData?.searchData?.travel_to?.id
    );

    const handleFirstDirectionData = (newData) => {
        const newValue = newData;
        dispatch(setWebSalesData({ path: "searchData/travel_from", value: newValue }));
    };
    const handleSecondDirectionData = (newData) => {
        const newValue = newData;
        dispatch(setWebSalesData({ path: "searchData/travel_to", value: newValue }));
    };

    const handleTravelDateData = (newData) => {
        const formatted = dayjs(newData).format("YYYY-MM-DD HH:mm");
        dispatch(setWebSalesData({ path: "searchData/travel_date", value: formatted }));
        setFirstDay(newData);
    };


    const handleChangeDate = (e, newValue) => {
        const formatted = dayjs(newValue).format("YYYY-MM-DD HH:mm");
        dispatch(
        setWebSalesData({ path: "searchData/travel_date", value: formatted })
        );
        if(newValue === d1.toISOString()){
        dtoswow = d1.toISOString()
        }
        else if(newValue === d2.toISOString()){
        dtoswow = d2.toISOString()
        }
        else if(newValue === d3.toISOString()){
        dtoswow = d3.toISOString()
        }
        else if(newValue === d4.toISOString()){
        dtoswow = d4.toISOString()
        }
        
    }

    const getWeekDay = (d) => {
        let returnDay = "";
        days[webSalesData.selectedLanguage?.code].forEach((day, index) => {
        if (index == new Date(d).getDay()) {
            returnDay = day[0].toUpperCase() + day.slice(1);
        }
        });
        return returnDay;
    };

    const canSearch = [
        searchData.travel_from,
        searchData.travel_to,
        searchData.travel_date,
    ].every(Boolean);

    useEffect(() => {
        if (canSearch) {
            dispatch(setGlobalLoading({ active: true, message: 'Tražimo dostupne polaske…' }));
            dispatch(postDataThunk({ path: "search_trips", data: searchData }))
                .unwrap()
                .finally(() => dispatch(setGlobalLoading({ active: false })));
        }
    }, [searchData]);

    return(
         <Grid>
            <Grid size={{lg:12}}>
                <Grid container direction="row" spacing={2}>
                <Grid size={{xs:12}}>
                    <Grid>
                    <Box display="flex" justifyContent="center" alignItems="center">
                        <img
                        alt="profile-user"
                        height="75px"
                        src={logo}
                        style={{ cursor: "pointer", borderRadius: "5%" }}
                        />
                    </Box>
                    {webSalesData?.salesData?.tickets?.length ? (
                        <Title subtitle={t('search.title_additional')} />
                    ) : (
                        <Title subtitle={t('search.title_empty')} />
                    )}
                    </Grid>
                    <Grid container direction="column" spacing={2}>
                    <Grid  >
                        <Autocomplete
                        disablePortal
                        id="travel_from"
                        options={filteredHarborsFrom || []}
                        getOptionLabel={(option) => option?.name || ""}
                        fullwidth="true"
                        renderInput={(params) => (
                            <TextField
                            {...params}
                            label={t('search.travel_from')}
                            />
                        )}
                        onChange={(event, newValue) => {
                            handleFirstDirectionData(newValue);
                        }}
                        />
                    </Grid>
                    <Grid >
                        <Autocomplete
                        disablePortal
                        id="travel_to"
                        options={filteredHarborsTo || []}
                        getOptionLabel={(option) => option?.name || ""}
                        fullwidth="true"
                        renderInput={(params) => (
                            <TextField
                            {...params}
                            label={t('search.travel_to')}
                            />
                        )}
                        onChange={(event, newValue) => {
                            handleSecondDirectionData(newValue);
                        }}
                        />
                    </Grid>

                    <Grid container direction="row" spacing={1} mb={2}>
                        <Grid size={{xs:12,sm:12,md:8}}>
                        <ToggleButtonGroup
                            variant="contained"
                            aria-label="outlined primary button group"
                            fullWidth
                            value={webSalesData?.searchData?.travel_date}
                            onChange={handleChangeDate}
                            color="primary"
                            exclusive
                            sx={{
                            height: 57,
                            }}
                        >
                            <ToggleButton value={d1.toISOString()} aria-label="d1">
                            <Stack direction="column">
                                <Typography sx={{ textTransform: "capitalize" }}>
                                {getWeekDay(d1)}
                                </Typography>
                                <Typography>{new Date(d1).getDate()}</Typography>
                            </Stack>
                            </ToggleButton>
                            <ToggleButton value={d2.toISOString()} aria-label="d2">
                            <Stack direction="column">
                                <Typography sx={{ textTransform: "capitalize" }}>
                                {getWeekDay(d2)}
                                </Typography>
                                <Typography>{new Date(d2).getDate()}</Typography>
                            </Stack>
                            </ToggleButton>
                            <ToggleButton value={d3.toISOString()} aria-label="d3">
                            <Stack direction="column">
                                <Typography sx={{ textTransform: "capitalize" }}>
                                {getWeekDay(d3)}
                                </Typography>
                                <Typography>{new Date(d3).getDate()}</Typography>
                            </Stack>
                            </ToggleButton>
                            <ToggleButton value={d4.toISOString()} aria-label="d4">
                            <Stack direction="column">
                                <Typography sx={{ textTransform: "capitalize" }}>
                                {getWeekDay(d4)}
                                </Typography>
                                <Typography>{new Date(d4).getDate()}</Typography>
                            </Stack>
                            </ToggleButton>
                        </ToggleButtonGroup>
                        </Grid>
                        <Grid size={{xs:12,sm:12,md:4}}>
                        <Box>
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <Stack spacing={3}>
                                <DesktopDatePicker
                                    label={t("search.travel_date")}
                                    format="DD/MM/YYYY"
                                    disablePast
                                    slotProps={{ textField: { size: "medium", fullWidth: true } }}
                                    value={travelDate ? dayjs(travelDate) : null}
                                    onChange={(newValue) => {
                                        if (!newValue) return;

                                        console.log(newValue.date());
                                        console.log(newValue.month() + 1);
                                        console.log(newValue.year());

                                        handleTravelDateData(newValue.format("YYYY-MM-DD 00:00"));
                                    }}
                                />
                            </Stack>
                            </LocalizationProvider>
                        </Box>
                        </Grid>
                    </Grid>
                    </Grid>
                </Grid>
                </Grid>
            </Grid>
        </Grid>
    )
}