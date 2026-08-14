import { Box, Button, Drawer, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk } from "../../boatSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";


export default function HarborsPage (){
    const dispatch = useDispatch()
    const boatData = useSelector(boatSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    const [editedData, setEditedData] = useState({})

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o lukama'}))
        await dispatch(getBoatThunk({path:'harbors'}))
        await dispatch(getBoatThunk({path:'regions'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const regions = boatData.boatData.regions || []
    const handleRegionChange = (e, target) => {
        const code = e.target.value
        const reg = regions.find((r) => r.uuid === code)
        const setter = target === "edit" ? setEditedData : setNewData
        const base = target === "edit" ? editedData : newData
        setter({ ...base, region_uuid: reg?.uuid || "", region: reg?.name || "" })
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
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje nove luke'}))
        await dispatch(postBoatThunk({path:'harbors', data:newData}))
        setNewData({})
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o lukama'}))
        await dispatch(patchBoatThunk({path:'harbors', data:editedData}))
        setEditedData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     useEffect(()=>{
        setEditedData(selectedRow)
     },[selectedRow])

    // Luke nemaju is_active — samo klik za uređivanje.
    const rowActions = useRowClickActions({ onEdit: (row) => setSelectedRow(row) })

     const columns = [
        { field: 'name', headerName:t('boat.harbors.name'), flex: 3 },
        { field: 'code', headerName:t('boat.harbors.code'), flex: 3 },
        { field: 'longitude', headerName:t('boat.harbors.longitude'), flex: 3 },
        { field: 'latitude', headerName:t('boat.harbors.latitude'), flex: 3 },
        { field: 'region', headerName:t('boat.harbors.region'), flex: 3 },            
        { field: 'city', headerName:t('boat.harbors.city'), flex: 3 },            
        { field: 'seop_island', headerName:t('boat.harbors.seop_island'), flex: 3 },            
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
                <GridHint withToggle={false} />
                <Box
                    sx={{
                        height:"80vh",
                        minWidth: 1200
                    }}
                >
                    <DataGrid
                        rows={boatData.boatData.harbors || ''}
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
                        label={t('boat.harbors.name')}
                        placeholder={t('boat.harbors.name')}
                        required
                        value={newData.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                     <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.code')}
                        placeholder={t('boat.harbors.code')}
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
                        label={t('boat.harbors.longitude')}
                        placeholder={t('boat.harbors.longitude')}                        
                        value={newData.longitude || ""}
                        onChange={handleChange}
                        name="longitude"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.latitude')}
                        placeholder={t('boat.harbors.latitude')}                        
                        value={newData.latitude || ""}
                        onChange={handleChange}
                        name="latitude"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.city')}
                        placeholder={t('boat.harbors.city')}                        
                        value={newData.city || ""}
                        onChange={handleChange}
                        name="city"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        select
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.region')}
                        required
                        value={newData.region_uuid || ""}
                        onChange={(e) => handleRegionChange(e, "new")}
                        name="region_uuid"
                        sx={{ mt:1 }}
                    >
                        <MenuItem value="">—</MenuItem>
                        {regions.map((r) => (
                            <MenuItem key={r.uuid} value={r.uuid}>
                                {r.name}{r.code ? ` (${r.code})` : ""}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.seop_island')}
                        placeholder={t('boat.harbors.seop_island')}                       
                        value={newData.seop_island || ""}
                        onChange={handleChange}
                        name="seop_island"
                        sx={{
                            mt:1
                        }}
                    />
                    <Button
                        type="submit"
                        
                        onClick={handleSubmit}
                        disabled={
                            !newData.name
                            || !newData.code
                            || !newData.region_uuid
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
                        label={t('boat.harbors.name')}
                        placeholder={t('boat.harbors.name')}
                        required
                        value={editedData?.name || ""}
                        onChange={handleChangeEdit}
                        name="name"
                    />
                     <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.code')}
                        placeholder={t('boat.harbors.code')}
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
                        label={t('boat.harbors.longitude')}
                        placeholder={t('boat.harbors.longitude')}                        
                        value={editedData?.longitude || ""}
                        onChange={handleChangeEdit}
                        name="longitude"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.latitude')}
                        placeholder={t('boat.harbors.latitude')}                        
                        value={editedData?.latitude || ""}
                        onChange={handleChangeEdit}
                        name="latitude"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.city')}
                        placeholder={t('boat.harbors.city')}                        
                        value={editedData?.city || ""}
                        onChange={handleChangeEdit}
                        name="city"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        select
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.region')}
                        value={editedData?.region_uuid || ""}
                        onChange={(e) => handleRegionChange(e, "edit")}
                        name="region_uuid"
                        sx={{
                            mt:1
                        }}
                        slotProps={{ select: { displayEmpty: true } }}
                    >
                        <MenuItem value="">—</MenuItem>
                        {regions.map((r) => (
                            <MenuItem key={r.uuid} value={r.uuid}>
                                {r.name}{r.code ? ` (${r.code})` : ""}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('boat.harbors.seop_island')}
                        placeholder={t('boat.harbors.seop_island')}                       
                        value={editedData?.seop_island || ""}
                        onChange={handleChangeEdit}
                        name="seop_island"
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
                            {t('boat.harbors.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAdd(true)}>
                    {t('boat.harbors.add_harbor')}
                </Button>
            </Stack>
        </>    
    )
}