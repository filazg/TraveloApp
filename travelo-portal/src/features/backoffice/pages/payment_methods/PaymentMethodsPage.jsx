import { Box, Button, Drawer, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";


// Tko provodi karticnu transakciju. Prodajni kanal po ovome zna smije li
// sredstvo ponuditi i koji uredaj pokrece: MONRI je web naplata, OTP_POS je
// serijski terminal na blagajni, SEVENPAY je 7pay. Prazno = kartica bez
// integracije, aplikacija ne pokrece nikakvu transakciju.
const CARD_PROVIDERS = [
    { value: '', label: 'Bez integracije' },
    { value: 'MONRI', label: 'Monri (web)' },
    { value: 'OTP_POS', label: 'OTP POS (blagajna)' },
    { value: 'SEVENPAY', label: '7pay' },
];

export default function PaymentMethodsPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    const [editedData, setEditedData] = useState({})

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o sredstvima plaćanja'}))
        await dispatch(getBackofficeThunk({path:'payment_methods'}))
        await dispatch(getBackofficeThunk({path:'payment_types'}))
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
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog sredstva plaćanja'}))
        await dispatch(postBackofficeThunk({path:'payment_methods', data:newData}))
        setNewData({})
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o sredstva plaćanja'}))
        await dispatch(patchBackofficeThunk({path:'payment_methods', data:editedData}))
        setEditedData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     useEffect(()=>{
        setEditedData(selectedRow)
     },[selectedRow])

    // Načini plaćanja nemaju is_active — samo klik za uređivanje.
    const rowActions = useRowClickActions({ onEdit: (row) => setSelectedRow(row) })

     const columns = [
       { field: 'name', headerName:t('backoffice.payment_methods.name'), flex: 2},
        { field: 'is_card_payment', type: 'boolean', headerName: t('backoffice.payment_methods.is_card_payment'), flex: 2},
        { field: 'card_provider', headerName: t('backoffice.payment_methods.card_provider'), flex: 2,
          valueGetter: (value) => CARD_PROVIDERS.find((p) => p.value === value)?.label || ''},
        { field: 'payment_type_acr', headerName: t('backoffice.payment_methods.acr'),align:'right', flex: 2},     
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
                        rows={backofficeData.backofficeData.payment_methods || ''}
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
                        {t('backoffice.payment_methods.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAdd(false)}>{t('backoffice.payment_methods.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.payment_methods.name')}
                        placeholder={t('backoffice.payment_methods.name')}
                        required
                        value={newData.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        select
                        label={t('backoffice.payment_methods.is_card_payment')}
                        placeholder={t('backoffice.payment_methods.is_card_payment')}
                        required
                        value={newData.is_card_payment || ""}
                        onChange={handleChange}
                        name="is_card_payment"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value='true' >{t('backoffice.payment_methods.is_card_payment_yes')}</MenuItem>
                        <MenuItem value='false'>{t('backoffice.payment_methods.is_card_payment_no')}</MenuItem>
                    </TextField>
                    <TextField
                        variant="outlined"
                        fullWidth
                        select
                        disabled={newData.is_card_payment !== 'true'}
                        helperText={newData.is_card_payment !== 'true' ? t('backoffice.payment_methods.card_provider_hint') : ''}
                        label={t('backoffice.payment_methods.card_provider')}
                        placeholder={t('backoffice.payment_methods.card_provider')}
                        value={newData.card_provider ?? ""}
                        onChange={handleChange}
                        name="card_provider"
                        sx={{
                            mt:1
                        }}
                        >
                        {CARD_PROVIDERS.map((cp) => (
                            <MenuItem key={cp.value || 'none'} value={cp.value}>{cp.label}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        select
                        label={t('backoffice.payment_methods.type')}
                        placeholder={t('backoffice.payment_methods.type')}
                        required
                        value={newData.type || ""}
                        onChange={handleChange}
                        name="type"
                        sx={{
                            mt:1
                        }}
                        >
                        {backofficeData.backofficeData?.payment_types?.map((type)=>(
                            <MenuItem key={type.id} value={type} >{type.name}</MenuItem>
                        ))}
                    </TextField>
                    <Button
                        type="submit"
                        
                        onClick={handleSubmit}
                        disabled={
                            !newData.name 
                            || !newData.is_card_payment
                            || !newData.type
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.business_premises.add_button')}
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
                    <Button  onClick={()=>setSelectedRow(null)}>{t('backoffice.business_premises.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.payment_methods.name')}
                        placeholder={t('backoffice.payment_methods.name')}
                        required
                        value={editedData?.name || ""}
                        onChange={handleChangeEdit}
                        name="name"
                    />
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.payment_methods.is_card_payment')}
                        placeholder={t('backoffice.payment_methods.is_card_payment')}
                        required
                        value={editedData?.is_card_payment || ""}
                        name="is_card_payment"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        variant="outlined"
                        fullWidth
                        select
                        disabled={editedData?.is_card_payment !== true && String(editedData?.is_card_payment) !== 'true'}
                        helperText={editedData?.is_card_payment !== true && String(editedData?.is_card_payment) !== 'true' ? t('backoffice.payment_methods.card_provider_hint') : ''}
                        label={t('backoffice.payment_methods.card_provider')}
                        placeholder={t('backoffice.payment_methods.card_provider')}
                        value={editedData?.card_provider ?? ""}
                        onChange={handleChangeEdit}
                        name="card_provider"
                        sx={{
                            mt:1
                        }}
                        >
                        {CARD_PROVIDERS.map((cp) => (
                            <MenuItem key={cp.value || 'none'} value={cp.value}>{cp.label}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.payment_methods.type')}
                        placeholder={t('backoffice.payment_methods.type')}
                        required
                        value={editedData?.payment_type_acr || ""}
                        name="payment_type"
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
                            {t('backoffice.payment_methods.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAdd(true)}>
                    {t('backoffice.payment_methods.add_payment_method')}
                </Button>
            </Stack>
        </>    
    )
}