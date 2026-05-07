import { Box, Button, Drawer, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk } from "../../boatSlice";


export default function LinesPage (){
    const dispatch = useDispatch()
    const boatData = useSelector(boatSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    const [editedData, setEditedData] = useState({})

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o linijama'}))
        await dispatch(getBoatThunk({path:'lines'}))
        await dispatch(getBoatThunk({path:'harbors'}))
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
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje nove linije'}))
        await dispatch(postBoatThunk({path:'lines', data:newData}))
        setNewData({})
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o linijama'}))
        await dispatch(patchBoatThunk({path:'lines', data:editedData}))
        setEditedData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     useEffect(()=>{
        setEditedData(selectedRow)
     },[selectedRow])

     const columns = [
        { field: 'name', headerName:t('boat.lines.name'), flex: 3 },
        { field: 'code', headerName:t('boat.lines.code'), flex: 3 },
        { field: 'first_harbor_name', headerName:t('boat.lines.first_harbor_name'), flex: 3 },
        { field: 'last_harbor_name', headerName:t('boat.lines.last_harbor_name'), flex: 3 },
        { field: 'type', headerName:t('boat.lines.type'), flex: 3 },
        { field: 'is_active', type:'boolean', headerName:t('boat.lines.is_active') , flex: 3 },
            
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
                        rows={boatData.boatData.lines || ''}
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
                        label={t('boat.lines.name')}
                        placeholder={t('boat.lines.name')}
                        required
                        value={newData.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.code')}
                        placeholder={t('boat.lines.code')}
                        required
                        value={newData.code || ""}
                        onChange={handleChange}
                        name="code"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.first_harbor_name')}
                        placeholder={t('boat.lines.first_harbor_name')}
                        required
                        select
                        value={newData.first_harbor_name || ""}
                        onChange={handleChange}
                        name="first_harbor_name"
                        sx={{
                            mt:1
                        }}
                        >
                        {boatData.boatData?.harbors?.map((harbor) => (
                                <MenuItem key={harbor.id} value={harbor} >{harbor.name}</MenuItem>
                            ))} 
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.last_harbor_name')}
                        placeholder={t('boat.lines.last_harbor_name')}
                        required
                        select
                        value={newData.last_harbor_name || ""}
                        onChange={handleChange}
                        name="last_harbor_name"
                        sx={{
                            mt:1
                        }}
                        >
                        {boatData.boatData?.harbors?.map((harbor) => (
                                <MenuItem key={harbor.id} value={harbor} >{harbor.name}</MenuItem>
                            ))} 
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.type')}
                        placeholder={t('boat.lines.type')}
                        required
                        select
                        value={newData.type || ""}
                        onChange={handleChange}
                        name="type"
                        sx={{
                            mt:1
                        }}
                        >
                        {boatData.boatData?.linesTypes?.map((type) => (
                                <MenuItem key={type.id} value={type} >{type.name}</MenuItem>
                            ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="Nositelj troška (SAOP)"
                        placeholder="npr. NT-9141"
                        value={newData.saop_cost_bearer || ""}
                        onChange={handleChange}
                        name="saop_cost_bearer"
                        sx={{ mt:1 }}
                    />
                    <Button
                        type="submit"

                        onClick={handleSubmit}
                        disabled={
                            !newData.name
                            || !newData.code
                            || !newData.first_harbor_name
                            || !newData.last_harbor_name
                            || !newData.type
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
                        label={t('boat.lines.name')}
                        placeholder={t('boat.lines.name')}
                        required
                        value={editedData?.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.code')}
                        placeholder={t('boat.lines.code')}
                        required
                        disabled
                        value={editedData?.code || ""}
                        name="code"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.first_harbor_name')}
                        placeholder={t('boat.lines.first_harbor_name')}
                        required
                        disabled
                        value={editedData?.first_harbor || ""}
                        name="first_harbor_name"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.last_harbor_name')}
                        placeholder={t('boat.lines.last_harbor_name')}
                        required
                        disabled
                        value={editedData?.last_harbor || ""}
                        name="last_harbor_name"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.lines.type')}
                        placeholder={t('boat.lines.type')}
                        required
                        disabled
                        value={editedData?.type || ""}
                        name="type"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="Nositelj troška (SAOP)"
                        placeholder="npr. NT-9141"
                        value={editedData?.saop_cost_bearer || ""}
                        onChange={(e)=>setEditedData({...editedData, saop_cost_bearer: e.target.value})}
                        name="saop_cost_bearer"
                        sx={{ mt:1 }}
                    />
                    <Button
                        type="submit"
                        onClick={handleSubmitEdit}
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('boat.lines.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAdd(true)}>
                    {t('boat.lines.add_line')}
                </Button>
            </Stack>
        </>    
    )
}