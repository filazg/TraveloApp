import { Box, Button, Drawer, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk } from "../../boatSlice";


export default function BoatsPage (){
    const dispatch = useDispatch()
    const boatData = useSelector(boatSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    const [editedData, setEditedData] = useState({})

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o brodovima'}))
        await dispatch(getBoatThunk({path:'boats'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }
    
    useEffect(()=>{
        syncData()
    },[])

    const handleChange = async (e) => {
        setNewData({...newData, [e.target.name] : e.target.value})
    };
    const handleChangeEdit = async (e) => {
        setEditedData({...editedData, [e.target.name] : e.target.value})
    };

    const handleSubmit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog broda'}))
        await dispatch(postBoatThunk({path:'boats', data:newData}))
        setNewData({})
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o brodu'}))
        await dispatch(patchBoatThunk({path:'boats', data:editedData}))
        setEditedData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     useEffect(()=>{
        setEditedData(selectedRow)
     },[selectedRow])

     const columns = [
        { field: 'name', headerName:t('boat.boats.headerboatname'), flex: 3},
        { field: 'nib', headerName:t('boat.boats.headerboatnib'), flex: 3 },
        { field: 'imo', headerName:t('boat.boats.headerboatimo'), flex: 2 },
        { field: 'capacity', headerName:t('boat.boats.headerbasecapacity'), flex: 2},
        { field: 'vip_capacity', headerName:t('boat.boats.headerbasevipcapacity'), flex: 2},
        { field: 'pets_capacity', headerName:t('boat.boats.headerbasepetscapacity'), flex: 2},
        { field: 'bicycle_capacity', headerName:t('boat.boats.headerbasebicyclecapacity'), flex: 2},           
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
                        rows={boatData.boatData.boats || ''}
                        columns={columns}
                        getRowId={(row) => row.id}
                        onCellClick={(params) => setSelectedRow(params.row)}
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
                        {t('boat.lines.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAdd(false)}>{t('boat.lines.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerboatname')}
                        placeholder={t('boat.boats.headerboatname')}
                        required
                        value={newData.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerboatnib')}
                        placeholder={t('boat.boats.headerboatnib')}
                        required
                        value={newData.nib || ""}
                        onChange={handleChange}
                        name="nib"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerboatimo')}
                        placeholder={t('boat.boats.headerboatimo')}
                        required
                        value={newData.imo || ""}
                        onChange={handleChange}
                        name="imo"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasecapacity')}
                        placeholder={t('boat.boats.headerbasecapacity')}
                        value={newData.capacity || ""}
                        onChange={handleChange}
                        name="capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasevipcapacity')}
                        placeholder={t('boat.boats.headerbasevipcapacity')}
                        value={newData.vip_capacity || ""}
                        onChange={handleChange}
                        name="vip_capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasepetscapacity')}
                        placeholder={t('boat.boats.headerbasepetscapacity')}
                        value={newData.pets_capacity || ""}
                        onChange={handleChange}
                        name="pets_capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasebicyclecapacity')}
                        placeholder={t('boat.boats.headerbasebicyclecapacity')}
                        value={newData.bicycle_capacity || ""}
                        onChange={handleChange}
                        name="bicycle_capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <Button
                        type="submit"
                        
                        onClick={handleSubmit}
                        disabled={
                            !newData.name 
                            || !newData.imo
                            || !newData.nib
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('boat.lines.add_button')}
                    </Button>
                </Box>
            </Drawer>
            <Drawer
                anchor="right"
                open={selectedRow}
                onClose={() => setSelectedRow(null)}
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
                        {t('backoffice.business_premises.edit_title')}
                    </Typography>
                    <Button onClick={()=>setSelectedRow(null)}>{t('backoffice.business_premises.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerboatname')}
                        placeholder={t('boat.boats.headerboatname')}
                        required
                        value={editedData?.name || ""}
                        onChange={handleChangeEdit}
                        name="name"
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('boat.boats.headerboatnib')}
                        placeholder={t('boat.boats.headerboatnib')}
                        required
                        value={editedData?.nib || ""}
                        name="nib"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('boat.boats.headerboatimo')}
                        placeholder={t('boat.boats.headerboatimo')}
                        required
                        value={editedData?.imo || ""}
                        name="imo"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasecapacity')}
                        placeholder={t('boat.boats.headerbasecapacity')}
                        value={editedData?.capacity || ""}
                        onChange={handleChangeEdit}
                        name="capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasevipcapacity')}
                        placeholder={t('boat.boats.headerbasevipcapacity')}
                        value={editedData?.vip_capacity || ""}
                        onChange={handleChangeEdit}
                        name="vip_capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasepetscapacity')}
                        placeholder={t('boat.boats.headerbasepetscapacity')}
                        value={editedData?.pets_capacity || ""}
                        onChange={handleChangeEdit}
                        name="pets_capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('boat.boats.headerbasebicyclecapacity')}
                        placeholder={t('boat.boats.headerbasebicyclecapacity')}
                        value={editedData?.bicycle_capacity || ""}
                        onChange={handleChangeEdit}
                        name="bicycle_capacity"
                        sx={{
                            mt:1
                        }}
                    />
                    <Button
                        type="submit"
                        onClick={handleSubmitEdit}
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('boat.boats.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAdd(true)}>
                    {t('boat.boats.add_boat')}
                </Button>
            </Stack>
        </>    
    )
}