import { Box, Button, Drawer, Grid, MenuItem, Modal, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import dayjs from "dayjs";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";
import PageTitle from "../../../../helpers/PageTitle";


export default function HolidaysPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    // Praznik koji se uređuje; isti drawer služi za dodavanje i uređivanje.
    const [editRow, setEditRow] = useState(null)

    // Datum je spremljen kao "DD/MM/YYYY"; dayjs bi takav tekst procitao kao
    // mjesec/dan, pa se rastavlja rucno.
    const pickerValue = (v) => {
        const [d, m, y] = String(v || "").split("/")
        return y && m && d ? dayjs(new Date(Number(y), Number(m) - 1, Number(d))) : null
    }

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

    const openEdit = (row) => {
        setEditRow(row)
        setNewData({ name: row.name, date: row.date_from })
        setOpenAdd(true)
    }

    const closeDrawer = () => {
        setOpenAdd(false)
        setEditRow(null)
        setNewData({})
    }

    const handleSubmit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value: editRow ? 'Ažuriranje praznika' : 'Dodavanje novog praznika'}))
        if (editRow) {
            await dispatch(patchBackofficeThunk({path:'holidays', data:{ uuid: editRow.uuid, name: newData.name, date: newData.date }}))
        } else {
            await dispatch(postBackofficeThunk({path:'holidays', data:newData}))
        }
        closeDrawer()
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    // Klik uređuje naziv i datum, dupli klik aktivira/deaktivira redak.
     const handleToggleRow = async (data) =>{
        const dataToSend = {
            uuid:data.uuid,
            is_active: data.is_active === false
        }

        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje praznika'}))
        await dispatch(patchBackofficeThunk({path:'holidays', data:dataToSend}))
        setNewData({})
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const rowActions = useRowClickActions({ onEdit: openEdit, onToggle: handleToggleRow })

     const columns = [
        {field: 'date_from', headerName:t('backoffice.holidays.date'), flex: 2 },
        {field: 'name', headerName:t('backoffice.holidays.name'), flex: 2},
        {
            field: 'is_active',
            headerName: 'Aktivan',
            width: 120,
            valueGetter: (_v, row) => (row.is_active ? 'DA' : 'NE'),
        },
    ];

    return(
        <>
       <Box sx={{
            mt:2,
            ml:2,
            width: "98%", 
            overflowX: "auto"
        }}>            
            <PageTitle>Praznici</PageTitle>
            <>
                <GridHint text="Klik na redak — uredi praznik. Dupli klik — aktiviraj/deaktiviraj. Neaktivni se ne primjenjuju u voznom redu." />
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
                        {...rowActions}
                    />
                </Box>                
            </>
        </Box>    
            <Drawer
                anchor="right"
                open={openAdd}
                onClose={closeDrawer}
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
                        {editRow ? 'Uređivanje praznika' : t('backoffice.holidays.add_new_title')}
                    </Typography>
                    <Button onClick={closeDrawer}>{t('backoffice.holidays.close')}</Button>
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
                      disablePast={!editRow}
                      sx={{
                        width: '100%',
                        mt:1
                      }}
                      value={pickerValue(newData.date)}
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
                            {editRow ? 'Spremi izmjene' : t('backoffice.holidays.add_new_title')}
                    </Button>
                </Box>
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>{ closeDrawer(); setOpenAdd(true) }}>
                    {t('backoffice.holidays.add_new_title')}
                </Button>
            </Stack>
          
        </>    
    )
}