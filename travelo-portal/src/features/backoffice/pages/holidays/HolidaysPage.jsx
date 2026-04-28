import { Box, Button, Drawer, Grid, MenuItem, Modal, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import dayjs from "dayjs";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useRef, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";


export default function HolidaysPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o praznicima'}))
        await dispatch(getBackofficeThunk({path:'holidays'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }
    
    useEffect(()=>{
        syncData()
    },[])

    const handleChange = async (e) => {
         setNewData({...newData, [e.target.name] : e.target.value})
    };

    const handleSetDate = async(data)=>{
         setNewData({...newData, date : data.toLocaleDateString("en-GB")})
    }

    useEffect(()=>{
        console.log(newData)

    },[newData])

    const handleSubmit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog praznika'}))
        await dispatch(postBackofficeThunk({path:'holidays', data:newData}))
        setNewData({})
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     const handleRemoveRow = async (data) =>{
        console.log(data)
        const dataToSend = {
            uuid:data.uuid,
            is_active:false
        }

        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje praznika'}))
        await dispatch(patchBackofficeThunk({path:'holidays', data:dataToSend}))
        setNewData({})
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     const columns = [
        {field: 'date_from', headerName:t('backoffice.holidays.date'), flex: 2 },
        {field: 'name', headerName:t('backoffice.holidays.name'), flex: 2}
    ];

    return(
        <>
       <Box sx={{
            mt:2,
            ml:2,
            width: "98%", 
            overflowX: "auto"
        }}>            
            <>
                <Box
                    sx={{
                        height:"80vh",
                        minWidth: 1200
                    }}
                >
                    <DataGrid
                        rows={backofficeData.backofficeData.holidays || ''}
                        columns={columns}
                        getRowId={(row) => row.id}
                        onCellClick={(params) => handleRemoveRow(params.row)}
                    />
                </Box>                
            </>
        </Box>    
            <Drawer
                anchor="right"
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                PaperProps={{
                sx: { width: { xs: "100vw", sm: 520, md: 680 }, maxWidth: "100vw" },
                }}
            >
                <Box
                    sx={{mx:5}}
                >   
                <Stack
                    direction='row'
                    justifyContent='space-between'
                    sx={{ mb:3 }}
                >
                    <Typography
                        variant="h5"
                        fontWeight="bold"
                        >
                        {t('backoffice.holidays.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAdd(false)}>{t('backoffice.holidays.close')}</Button>
                </Stack>
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.holidays.name')}
                    placeholder={t('backoffice.holidays.name')}
                    required
                    value={newData.name || ""}
                    onChange={handleChange}
                    name="name"
                />
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label={t('backoffice.holidays.date')}
                      format="DD.MM.YYYY"
                      disablePast
                      sx={{
                        width: '100%',
                        mt:1
                      }}
                      value={dayjs(newData.date)}
                      onChange={(event, newValue) => {
                        console.log("date");
                        handleSetDate(event.$d);
                      }}
                    />
                  </LocalizationProvider>
                    <Button
                        type="submit"
                        
                        onClick={handleSubmit}
                        disabled={
                            !newData.name 
                            || !newData.date
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.holidays.add_new_title')}
                    </Button>
                </Box>
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAdd(true)}>
                    {t('backoffice.holidays.add_new_title')}
                </Button>
            </Stack>
          
        </>    
    )
}