import { Box, Button, Drawer, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";


export default function BusinessPremisesPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAddBusinessPremise, setOpenAddBusinessPremise] = useState(false)
    const [newBusinessPremiseData, setNewBusinessPremiseData] = useState({})
    const [editedBusinessPremiseData, setEditedBusinessPremiseData] = useState({})

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o poslovnim prostorima'}))
        await dispatch(getBackofficeThunk({path:'business_premises'}))
        // Partneri se dohvaćaju ovdje jer se prodajno mjesto može označiti kao
        // partnersko. Bez ovoga je popis partnera bio prazan, pa se partner nije
        // imao odakle odabrati.
        await dispatch(getBackofficeThunk({path:'partners'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }
    
    useEffect(()=>{
        syncData()
    },[])

    const handleChange = async (e) => {
        setNewBusinessPremiseData({...newBusinessPremiseData, [e.target.name] : e.target.value})
    };
    const handleChangeEdit = async (e) => {
        setEditedBusinessPremiseData({...editedBusinessPremiseData, [e.target.name] : e.target.value})
    };

    // Partner se bira po uuid-u, a naziv se prepisuje uz njega — na prodajnom
    // mjestu stoje oba, da izvještaji ne moraju u šifarnik za ime.
    const partnerPoUuid = (uuid) => (backofficeData.backofficeData.partners || []).find((p) => p.uuid === uuid)
    const handlePartnerChange = async (e) => {
        const partner = partnerPoUuid(e.target.value)
        setNewBusinessPremiseData({
            ...newBusinessPremiseData,
            partner_uuid: partner?.uuid || '',
            partner_name: partner?.partner_name || '',
        })
    };
    const handlePartnerChangeEdit = async (e) => {
        const partner = partnerPoUuid(e.target.value)
        setEditedBusinessPremiseData({
            ...editedBusinessPremiseData,
            partner_uuid: partner?.uuid || '',
            partner_name: partner?.partner_name || '',
        })
    };

    const handleSubmit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog poslovnog prostora'}))
        await dispatch(postBackofficeThunk({path:'business_premises', data:newBusinessPremiseData}))
        setNewBusinessPremiseData({})
        setOpenAddBusinessPremise(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        console.log(editedBusinessPremiseData)
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o poslovnog prostora'}))
        await dispatch(patchBackofficeThunk({path:'business_premises', data:editedBusinessPremiseData}))
        setEditedBusinessPremiseData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     useEffect(()=>{
        setEditedBusinessPremiseData(selectedRow)
     },[selectedRow])

    const handleToggleActive = async (row) => {
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value: row.is_active ? 'Deaktivacija poslovnog prostora' : 'Aktivacija poslovnog prostora'}))
        await dispatch(patchBackofficeThunk({path:'business_premises', data:{ ...row, is_active: !row.is_active }}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const rowActions = useRowClickActions({
        onEdit: (row) => setSelectedRow(row),
        onToggle: handleToggleActive,
    })

     const columns = [
        { field: 'name', headerName:t('backoffice.business_premises.name'), flex: 2},
        { field: 'mark', headerName:t('backoffice.business_premises.mark'), flex: 2},
        { field: 'type', headerName:t('backoffice.business_premises.type') , flex: 2},
        // Partnersko prodajno mjesto se mora vidjeti iz popisa — po njemu ide
        // obračun provizije, pa nije svejedno je li mjesto naše ili partnerovo.
        { field: 'partner_name', headerName: t('backoffice.business_premises.partners'), flex: 2,
            valueGetter: (value, row) => (row?.bp_own === 'PARTNER_BP' ? (value || '—') : '') },
        { field: 'address', headerName:t('backoffice.business_premises.address') , flex: 2},
        { field: 'town', headerName:t('backoffice.business_premises.town'), flex: 2},
        { field: 'country', headerName:t('backoffice.business_premises.country'), flex: 2},
        { field: 'description', headerName:t('backoffice.business_premises.description'), flex: 2},
        { field: 'fiskal_mark', headerName: t('backoffice.business_premises.fiskal_mark'), flex: 2},
        { field: 'working_time', headerName: t('backoffice.business_premises.working_time'), flex: 2},
        { field: 'cost_center', headerName: t('backoffice.business_premises.cost_centre'), flex: 2},
        { field: 'tel', headerName:t('backoffice.business_premises.tel'), flex: 2},
        { field: 'email', headerName:t('backoffice.business_premises.email'), flex: 2},
        { field: 'is_active', type: 'boolean', headerName:t('backoffice.business_premises.is_active'), flex: 2},
     
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
                <GridHint />
                <Box
                    sx={{
                        height:"80vh",
                        minWidth: 1200
                    }}
                >
                    <DataGrid
                        rows={backofficeData.backofficeData.business_premises || ''}
                        columns={columns}
                        getRowId={(row) => row.id}
                        {...rowActions}
                    />
                </Box>                
            </>
        </Box>    
            <Drawer
                anchor="right"
                open={openAddBusinessPremise}
                onClose={() => setOpenAddBusinessPremise(false)}
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
                        {t('backoffice.business_premises.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAddBusinessPremise(false)}>{t('backoffice.business_premises.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.name')}
                        placeholder={t('backoffice.business_premises.name')}
                        required
                        value={newBusinessPremiseData.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.mark')}
                        placeholder={t('backoffice.business_premises.mark')}
                        required
                        value={newBusinessPremiseData.mark || ""}
                        onChange={handleChange}
                        name="mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.fiskal_mark')}
                        placeholder={t('backoffice.business_premises.fiskal_mark')}
                        required
                        value={newBusinessPremiseData.fiskal_mark || ""}
                        onChange={handleChange}
                        name="fiskal_mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        select
                        label={t('backoffice.business_premises.type')}
                        placeholder={t('backoffice.business_premises.type')}
                        required
                        value={newBusinessPremiseData.type || ""}
                        onChange={handleChange}
                        name="type"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value='POSL'>{t('backoffice.business_premises.type_physically')}</MenuItem>
                        <MenuItem value='MOBIL'>{t('backoffice.business_premises.type_movable')}</MenuItem>
                        <MenuItem value='WEB'>{t('backoffice.business_premises.type_web')}</MenuItem>
                        <MenuItem value='WEB_OFFICE'>{t('backoffice.business_premises.type_web_office')}</MenuItem>
                        <MenuItem value='URED'>{t('backoffice.business_premises.type_office')}</MenuItem>
                    </TextField>
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        select
                        label={t('backoffice.business_premises.bp_own')}
                        placeholder={t('backoffice.business_premises.bp_own')}
                        required
                        value={newBusinessPremiseData.bp_own || ""}
                        onChange={handleChange}
                        name="bp_own"
                        sx={{
                            mt:1
                        }}
                    >
                        <MenuItem value='OWN_BP'>{t('backoffice.business_premises.own_bp')}</MenuItem>
                        <MenuItem value='PARTNER_BP'>{t('backoffice.business_premises.partners_bp')}</MenuItem>
                    </TextField>
                    {newBusinessPremiseData.bp_own === 'PARTNER_BP' ? 
                        <>
                            <TextField
                                type="boolean"
                                variant="outlined"
                                fullWidth
                                select
                                label={t('backoffice.business_premises.partners')}
                                placeholder={t('backoffice.business_premises.partners')}
                                required
                                value={newBusinessPremiseData.partner_uuid || ""}
                                onChange={handlePartnerChange}
                                name="partner_uuid"
                                 sx={{
                                    mt:1
                                }}
                            >
                                {/* Vrijednost je uuid, ne cijeli objekt — backend
                                    sprema partner_uuid i partner_name, pa je prije
                                    ostajalo neupisano i kad se partner odabrao.
                                    Uz naziv stoji i provizija, jer se po njoj
                                    obračunava, pa se odmah vidi što je odabrano. */}
                                {backofficeData.backofficeData.partners?.map((partner)=>(
                                <MenuItem key={partner.uuid} value={partner.uuid}>
                                    {partner.partner_name}
                                    {partner.commission_pct != null ? ` — provizija ${Number(partner.commission_pct)} %` : ''}
                                </MenuItem>

                                ))}
                                </TextField>
                        </>  
                        : ''
                    }
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.address')}
                        placeholder={t('backoffice.business_premises.address')}
                        value={newBusinessPremiseData.address || ""}
                        onChange={handleChange}
                        name="address"
                        sx={{
                            mt:1
                        }}
                    /> 
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.town')}
                        placeholder={t('backoffice.business_premises.town')}
                        value={newBusinessPremiseData.town || ""}
                        onChange={handleChange}
                        name="town"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.country')}
                        placeholder={t('backoffice.business_premises.country')}
                        value={newBusinessPremiseData.country || ""}
                        onChange={handleChange}
                        name="country"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.working_time')}
                        placeholder={t('backoffice.business_premises.working_time')}
                        value={newBusinessPremiseData.working_time || ""}
                        onChange={handleChange}
                        name="working_time"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.cost_centre')}
                        placeholder={t('backoffice.business_premises.cost_centre')}
                        value={newBusinessPremiseData.cost_center || ""}
                        onChange={handleChange}
                        name="cost_center"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.tel')}
                        placeholder={t('backoffice.business_premises.tel')}
                        value={newBusinessPremiseData.tel || ""}
                        onChange={handleChange}
                        name="tel"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.email')}
                        placeholder={t('backoffice.business_premises.email')}
                        value={newBusinessPremiseData.email || ""}
                        onChange={handleChange}
                        name="email"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        select
                        required
                        label={t('backoffice.business_premises.is_active')}
                        placeholder={t('backoffice.business_premises.is_active')}
                        value={newBusinessPremiseData.is_active || ""}
                        onChange={handleChange}
                        name="is_active"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value='true'>{t('backoffice.business_premises.is_active_yes')}</MenuItem>
                        <MenuItem value='false'>{t('backoffice.business_premises.is_active_no')}</MenuItem>
                    </TextField>
                    <Button
                        type="submit"
                        
                        onClick={handleSubmit}
                        disabled={
                            !newBusinessPremiseData.name 
                            || !newBusinessPremiseData.mark
                            || !newBusinessPremiseData.fiskal_mark
                            || !newBusinessPremiseData.type
                            || !newBusinessPremiseData.is_active
                            //|| !shiftIsOpen
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
                    <Button onClick={()=>setSelectedRow(null)}>{t('backoffice.business_premises.close')}</Button>
                </Stack>
                <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.name')}
                        placeholder={t('backoffice.business_premises.name')}
                        required
                        value={editedBusinessPremiseData?.name || ""}
                        onChange={handleChangeEdit}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.business_premises.mark')}
                        placeholder={t('backoffice.business_premises.mark')}
                        required
                        value={editedBusinessPremiseData?.mark || ""}
                        name="mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.business_premises.fiskal_mark')}
                        placeholder={t('backoffice.business_premises.fiskal_mark')}
                        required
                        value={editedBusinessPremiseData?.fiskal_mark || ""}
                        name="fiskal_mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.business_premises.type')}
                        placeholder={t('backoffice.business_premises.type')}
                        required
                        value={editedBusinessPremiseData?.type || ""}
                        name="type"
                        sx={{
                            mt:1
                        }}
                    />
                    {/* Vlasništvo i partner se smiju mijenjati i naknadno:
                        prodajno mjesto zna prijeći s vlastitog na partnersko ili
                        promijeniti partnera, a dosad se to moglo samo pri unosu. */}
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        select
                        label={t('backoffice.business_premises.bp_own')}
                        placeholder={t('backoffice.business_premises.bp_own')}
                        required
                        value={editedBusinessPremiseData?.bp_own || ""}
                        onChange={handleChangeEdit}
                        name="bp_own"
                        sx={{
                            mt:1
                        }}
                    >
                        <MenuItem value='OWN_BP'>{t('backoffice.business_premises.own_bp')}</MenuItem>
                        <MenuItem value='PARTNER_BP'>{t('backoffice.business_premises.partners_bp')}</MenuItem>
                    </TextField>
                    {editedBusinessPremiseData?.bp_own === 'PARTNER_BP' ?
                        <>
                            <TextField
                                type="boolean"
                                variant="outlined"
                                fullWidth
                                select
                                label={t('backoffice.business_premises.partners')}
                                placeholder={t('backoffice.business_premises.partners')}
                                required
                                value={editedBusinessPremiseData?.partner_uuid || ""}
                                onChange={handlePartnerChangeEdit}
                                name="partner_uuid"
                                 sx={{
                                    mt:1
                                }}
                            >
                                {backofficeData.backofficeData.partners?.map((partner)=>(
                                <MenuItem key={partner.uuid} value={partner.uuid}>
                                    {partner.partner_name}
                                    {partner.commission_pct != null ? ` — provizija ${Number(partner.commission_pct)} %` : ''}
                                </MenuItem>
                                ))}
                            </TextField>
                        </>
                        : ''
                    }
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.address')}
                        placeholder={t('backoffice.business_premises.address')}
                        value={editedBusinessPremiseData?.address || ""}
                        onChange={handleChangeEdit}
                        name="address"
                        sx={{
                            mt:1
                        }}
                    /> 
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.town')}
                        placeholder={t('backoffice.business_premises.town')}
                        value={editedBusinessPremiseData?.town || ""}
                        onChange={handleChangeEdit}
                        name="town"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.country')}
                        placeholder={t('backoffice.business_premises.country')}
                        value={editedBusinessPremiseData?.country || ""}
                        onChange={handleChangeEdit}
                        name="country"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.working_time')}
                        placeholder={t('backoffice.business_premises.working_time')}
                        value={editedBusinessPremiseData?.working_time || ""}
                        onChange={handleChangeEdit}
                        name="working_time"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.cost_centre')}
                        placeholder={t('backoffice.business_premises.cost_centre')}
                        value={editedBusinessPremiseData?.cost_center || ""}
                        onChange={handleChangeEdit}
                        name="cost_center"
                         sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.tel')}
                        placeholder={t('backoffice.business_premises.tel')}
                        value={editedBusinessPremiseData?.tel || ""}
                        onChange={handleChangeEdit}
                        name="tel"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.business_premises.email')}
                        placeholder={t('backoffice.business_premises.email')}
                        value={editedBusinessPremiseData?.email || ""}
                        onChange={handleChangeEdit}
                        name="email"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        select
                        required
                        label={t('backoffice.business_premises.is_active')}
                        placeholder={t('backoffice.business_premises.is_active')}
                        value={editedBusinessPremiseData?.is_active || ""}
                        onChange={handleChangeEdit}
                        name="is_active"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value='true'>{t('backoffice.business_premises.is_active_yes')}</MenuItem>
                        <MenuItem value='false'>{t('backoffice.business_premises.is_active_no')}</MenuItem>
                    </TextField>
                    <Button
                        type="submit"
                        onClick={handleSubmitEdit}
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.business_premises.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAddBusinessPremise(true)}>
                    {t('backoffice.business_premises.add_business_premise')}
                </Button>
            </Stack>
        </>    
    )
}