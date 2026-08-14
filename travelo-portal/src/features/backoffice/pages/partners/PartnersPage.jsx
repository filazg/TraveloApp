import axios from "axios";
import { Box, Button, Checkbox, Drawer, FormControlLabel, Grid, IconButton, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Modal, Paper, Stack, TextField, Typography } from "@mui/material";
import { DataGrid, GridActionsCellItem } from "@mui/x-data-grid";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useRef, useState } from "react";
import { resetAuthData, setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { inactiveRowClass } from "../../../../helpers/gridRowActions";


export default function PartnersPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    const [editedData, setEditedData] = useState({})
    const [addWebModal, setAddWebModal] = useState(false)
    const [addApiModal, setAddApiModal] = useState(false)
    const [newWebUser, setNewWebUser] = useState([])
    const [newApiUser, setNewApiUser] = useState([])
    const [webUser, setWebUser] = useState({})
    const [apiUser, setApiUser] = useState({})
    const [rowToActivate, setRowsToActivate] = useState(null);
    

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o partnerima'}))
        await dispatch(getBackofficeThunk({path:'partners'}))
        await dispatch(getBackofficeThunk({path:'countries'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const activeCountries = (backofficeData.backofficeData.countries || []).filter(c => c.is_active)
  
    useEffect(()=>{
        syncData()
    },[])

    const clickTimerRef = useRef(null);
    const clickDelay = 250;

    const handleActivate = async(status)=>{
        await dispatch(setAuthData({ path: "loading", value: true }));
        let message = 'Deeaktiviranje partnera'
        if(status){
            message='Aktiviranje partnera'
        }
        await dispatch(setAuthData({ path: "loadingMessage", value: message }));
        setRowsToActivate(null)
        const dataToSend = { ...rowToActivate, is_active: status };
        await dispatch(
        patchBackofficeThunk({ path: "partners", data: dataToSend }),
        )
        await dispatch(setAuthData({ path: "loading", value: false }));
    }

    const handleChange = async (e) => {
        setNewData({...newData, [e.target.name] : e.target.value})
    };
    const handleChangeEdit = async (e) => {
        setEditedData({...editedData, [e.target.name] : e.target.value})
    };

    const handleSubmit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog partnera'}))
        await dispatch(postBackofficeThunk({path:'partners', data:newData}))
        setNewData({})
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();        
        const dataToSend = {
            ...editedData,
            web_permissions: newWebUser,
            api_permissions: newApiUser
        };

        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o partneru'}))
        await dispatch(patchBackofficeThunk({path:'partners', data:dataToSend}))
        setEditedData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    useEffect(()=>{
        if(selectedRow){
            setEditedData(selectedRow)
            setNewWebUser(selectedRow.web_permissions)
            setNewApiUser(selectedRow.api_permissions)
        }
     },[selectedRow])

     const columns = [
        { field: 'partner_name', headerName:t('backoffice.partners.partner_name'), flex: 2},
        { field: 'partner_vat_id', headerName:t('backoffice.partners.partner_vat_id'), flex: 2},
        { field: 'partner_address', headerName:t('backoffice.partners.partner_address'), flex: 2},
        { field: 'partner_town', headerName:t('backoffice.partners.partner_town'), flex: 2,  editable: true},
        { field: 'partner_postal_code', headerName:t('backoffice.partners.partner_postal_code'), flex: 2},
        { field: 'partner_country', headerName:t('backoffice.partners.partner_country'), flex: 2},
        { field: 'partner_email', headerName: t('backoffice.partners.partner_email'), flex: 2},
        {
              field: "is_active",
              headerName: t("backoffice.partners.partner_is_active"),
              flex: 3,
              renderCell: (params) => {
                const active = params.value;
        
                return (
                  <Box
                    sx={{
                      width: "100%",
                      textAlign: "center",
                      fontWeight: 600,
                      color: active ? "#1b5e20" : "#b71c1c",
                      backgroundColor: active ? "#c8e6c9" : "#ffcdd2", 
                      
                    }}
                  >
                    {active ? "Aktivan" : "Deaktivan"}
                  </Box>
                );
              }
            },
    ];

    const columns_web = [
        { field: 'username', headerName: t('backoffice.partners.web_user_username'), flex: 2, editable: true },
        { field: 'password', type: 'password', headerName: t('backoffice.partners.web_user_password'), flex: 2, editable: true },
        {
            field: 'actions',
            type: 'actions',
            headerName: '',
            width: 60,
            getActions: (params) => [
                <GridActionsCellItem
                    icon={<DeleteOutlineIcon />}
                    label="Delete"
                    onClick={() => remoweSelectedWebUser(params.row)}
                />,
            ],
        },
    ]

    const columns_api = [
        { field: 'tid', headerName: t('backoffice.partners.api_user_tid'), flex: 2, editable: true },
        { field: 'otp', type: 'text', headerName: t('backoffice.partners.api_user_otp'), flex: 2, editable: true },
        { field: 'key', type: 'text', headerName: t('backoffice.partners.api_user_key'), flex: 2, editable: true },
        {
            field: 'actions',
            type: 'actions',
            headerName: '',
            width: 60,
            getActions: (params) => [
                <GridActionsCellItem
                    icon={<DeleteOutlineIcon />}
                    label="Delete"
                    onClick={() => remoweSelectedApiUser(params.row)}
                />,
            ],
        },
    ]

    const handleProcessWebRowUpdate = (newRow) => {
        setNewWebUser((prev) => prev.map((r) => (r.id === newRow.id ? { ...r, ...newRow } : r)));
        return newRow;
    };

    const handleProcessApiRowUpdate = (newRow) => {
        setNewApiUser((prev) => prev.map((r) => (r.id === newRow.id ? { ...r, ...newRow } : r)));
        return newRow;
    };

    const handleChangeNewWebUser = async(e)=>{
        setWebUser({
            ...webUser, [e.target.name]: e.target.value
        })
    }

    const handleAddWebUser = async ()=>{
        console.log(webUser)
        console.log(newWebUser)
        const newId = newWebUser.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
        webUser.id= newId
        const newData = [...newWebUser, webUser]
        setNewWebUser(newData)
        setWebUser({})
        setAddWebModal(false)
    }

    const remoweSelectedWebUser = async(data)=>{
        const filteredData = newWebUser.filter((web)=>web.id !== data.id)
        setNewWebUser(filteredData)
        console.log(data)
    }
    const handleChangeNewApiUser = async(e)=>{
        setApiUser({
            ...apiUser, [e.target.name]: e.target.value
        })
    }

    const handleAddApiUser = async ()=>{
        const newId = newApiUser.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
        apiUser.id= newId
        const newData = [...newApiUser, apiUser]
        setNewApiUser(newData)
        setApiUser({})
        setAddApiModal(false)
    }

    const remoweSelectedApiUser = async(data)=>{
        const filteredData = newApiUser.filter((api)=>api.id !== data.id)
        setNewApiUser(filteredData)
        console.log(data)
    }

    useEffect (()=>{
        console.log('NEW WEB USER', newWebUser)
    },[newWebUser])


    const style = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 600,
      hight: "75vh",
      bgcolor: "background.paper",
      boxShadow: 24,
      pt: 2,
      px: 4,
      pb: 3,
    };

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
                        rows={backofficeData.backofficeData.partners || ''}
                        columns={columns}
                        getRowId={(row) => row.id}
                        getRowClassName={inactiveRowClass()}
                        onCellClick={(params) => {
                            clearTimeout(clickTimerRef.current);
                            clickTimerRef.current = setTimeout(() => {
                                setSelectedRow(params.row)
                            }, clickDelay);
                        }}
                        onCellDoubleClick={(params, event) => {
                            event.defaultMuiPrevented = true; 
                            clearTimeout(clickTimerRef.current);
                            setRowsToActivate(params.row)
                        }}
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
                        {t('backoffice.partners.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAdd(false)}>{t('backoffice.partners.close')}</Button>
                </Stack>
                     <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_name')}
                        placeholder={t('backoffice.partners.partner_name')}
                        required
                        value={newData.partner_name || ""}
                        onChange={handleChange}
                        name="partner_name"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_acr')}
                        placeholder={t('backoffice.partners.partner_acr')}
                        required
                        value={newData.partner_acr || ""}
                        onChange={handleChange}
                        name="partner_acr"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_vat_id')}
                        placeholder={t('backoffice.partners.partner_vat_id')}
                        required
                        value={newData.partner_vat_id || ""}
                        onChange={handleChange}
                        name="partner_vat_id"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_address')}
                        placeholder={t('backoffice.partners.partner_address')}
                        required
                        value={newData.partner_address || ""}
                        onChange={handleChange}
                        name="partner_address"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_town')}
                        placeholder={t('backoffice.partners.partner_town')}
                        required
                        value={newData.partner_town || ""}
                        onChange={handleChange}
                        name="partner_town"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_postal_code')}
                        placeholder={t('backoffice.partners.partner_postal_code')}
                        required
                        value={newData.partner_postal_code || ""}
                        onChange={handleChange}
                        name="partner_postal_code"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        select
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_country')}
                        required
                        value={newData.partner_country || ""}
                        onChange={handleChange}
                        name="partner_country"
                        sx={{
                            mt:1
                        }}
                    >
                        <MenuItem value="">—</MenuItem>
                        {activeCountries.map((c) => (
                            <MenuItem key={c.code} value={c.code}>
                                {c.name_hr} ({c.code})
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_email')}
                        placeholder={t('backoffice.partners.partner_email')}
                        required
                        value={newData.partner_email || ""}
                        onChange={handleChange}
                        name="partner_email"
                        sx={{
                            mt:1
                        }}
                    />
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={
                            !newData.partner_name
                            || !newData.partner_vat_id
                            || !newData.partner_email
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.partners.add_button')}
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
                        {t('backoffice.partners.edit_title')}
                    </Typography>
                    <Button onClick={()=>setSelectedRow(null)}>{t('backoffice.partners.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_name')}
                        placeholder={t('backoffice.partners.partner_name')}
                        required
                        value={editedData.partner_name || ""}
                        onChange={handleChangeEdit}
                        name="partner_name"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_acr')}
                        placeholder={t('backoffice.partners.partner_acr')}
                        required
                        value={editedData.partner_acr || ""}
                        onChange={handleChangeEdit}
                        name="partner_acr"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_vat_id')}
                        placeholder={t('backoffice.partners.partner_vat_id')}
                        required
                        value={editedData.partner_vat_id || ""}
                        onChange={handleChangeEdit}
                        name="partner_vat_id"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_address')}
                        placeholder={t('backoffice.partners.partner_address')}
                        required
                        value={editedData.partner_address || ""}
                        onChange={handleChangeEdit}
                        name="partner_address"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_town')}
                        placeholder={t('backoffice.partners.partner_town')}
                        required
                        value={editedData.partner_town || ""}
                        onChange={handleChangeEdit}
                        name="partner_town"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_postal_code')}
                        placeholder={t('backoffice.partners.partner_postal_code')}
                        required
                        value={editedData.partner_postal_code || ""}
                        onChange={handleChangeEdit}
                        name="partner_postal_code"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        select
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_country')}
                        required
                        value={editedData.partner_country || ""}
                        onChange={handleChangeEdit}
                        name="partner_country"
                        sx={{
                            mt:1
                        }}
                    >
                        <MenuItem value="">—</MenuItem>
                        {activeCountries.map((c) => (
                            <MenuItem key={c.code} value={c.code}>
                                {c.name_hr} ({c.code})
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_email')}
                        placeholder={t('backoffice.partners.partner_email')}
                        required
                        value={editedData.partner_email || ""}
                        onChange={handleChangeEdit}
                        name="partner_email"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_commission_pct')}
                        placeholder={t('backoffice.partners.partner_commission_pct')}
                        value={editedData.commission_pct ?? ""}
                        onChange={handleChangeEdit}
                        name="commission_pct"
                        inputProps={{ min: 0, max: 100, step: 0.01 }}
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="number"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.partner_vat_rate')}
                        placeholder={t('backoffice.partners.partner_vat_rate')}
                        value={editedData.vat_rate ?? ""}
                        onChange={handleChangeEdit}
                        name="vat_rate"
                        inputProps={{ min: 0, max: 100, step: 0.01 }}
                        sx={{
                            mt:1
                        }}
                    />
                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                            <Checkbox
                                checked={!!editedData.f2_required}
                                onChange={(e) =>
                                    setEditedData({ ...editedData, f2_required: e.target.checked })
                                }
                                name="f2_required"
                            />
                        }
                        label={t('backoffice.partners.partner_f2_required')}
                    />
                    <Stack direction='row' justifyContent= "space-between" sx={{mt:1}} >
                        <Typography>{t('backoffice.partners.web_user_title')}</Typography>
                        <Button onClick={() => setAddWebModal(true)}>
                            {t('backoffice.partners.add')}
                        </Button>
                    </Stack>
                   <Box
                        sx={{
                            height:300,
                            minWidth: 200,
                            mb:3
                        }}
                    >
                        <DataGrid
                            rows={newWebUser || ''}
                            columns={columns_web}
                            getRowId={(row) => row.id}
                            processRowUpdate={handleProcessWebRowUpdate}
                            onProcessRowUpdateError={(err) => console.log('web row update error:', err)}
                        />
                    </Box> 
                    <Stack direction='row' justifyContent= "space-between" sx={{mt:1}} >
                        <Typography>{t('backoffice.partners.api_user_title')}</Typography>
                        <Button onClick={() => setAddApiModal(true)}>
                            {t('backoffice.partners.add')}
                        </Button>
                    </Stack> 
                   <Box
                        sx={{
                            height:300,
                            minWidth: 200
                        }}
                    >
                        <DataGrid
                            rows={newApiUser || ''}
                            columns={columns_api}
                            getRowId={(row) => row.id}
                            processRowUpdate={handleProcessApiRowUpdate}
                            onProcessRowUpdateError={(err) => console.log('api row update error:', err)}
                        />
                    </Box>  
                    <Button
                        type="submit"
                        onClick={handleSubmitEdit}
                        sx={{ height: 60, mt: 4, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.partners.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={handleSubmit}>
                    {t('backoffice.partners.add_partner')}
                </Button>
            </Stack>
            <Modal
                open={addWebModal} onClose={() => setAddWebModal(false)}
            >
                <Box sx={{ ...style, width: 300, overflowY: "auto" }}>
                    <Typography>{t('backoffice.partners.add_new_web_user_title')}</Typography>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.web_user_username')}
                        placeholder={t('backoffice.partners.web_user_username')}
                        required
                        value={webUser.username || ""}
                        onChange={handleChangeNewWebUser}
                        name="username"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.web_user_password')}
                        placeholder={t('backoffice.partners.web_user_password')}
                        required
                        value={webUser.password || ""}
                        onChange={handleChangeNewWebUser}
                        name="password"
                        sx={{
                            mt:1
                        }}
                    />
                    <Button
                        type="submit"
                        onClick={handleAddWebUser}
                        sx={{ height: 60, mt: 4, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.partners.add')}
                    </Button>
                </Box>
            </Modal>
            <Modal
                 open={addApiModal} onClose={() => setAddApiModal(false)}
            >
                <Box sx={{ ...style, width: 300, overflowY: "auto" }}>
                    <Typography>{t('backoffice.partners.add_new_api_user')}</Typography>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.api_user_tid')}
                        placeholder={t('backoffice.partners.api_user_tid')}
                        required
                        value={apiUser.tid || ""}
                        onChange={handleChangeNewApiUser}
                        name="tid"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.api_user_otp')}
                        placeholder={t('backoffice.partners.api_user_otp')}
                        required
                        value={apiUser.otp || ""}
                        onChange={handleChangeNewApiUser}
                        name="otp"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.partners.api_user_key')}
                        placeholder={t('backoffice.partners.api_user_key')}
                        required
                        value={apiUser.key || ""}
                        onChange={handleChangeNewApiUser}
                        name="key"
                        sx={{
                            mt:1
                        }}
                    />
                    <Button
                        type="submit"
                        onClick={handleAddApiUser}
                        sx={{ height: 60, mt: 4, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.partners.add')}
                    </Button>
                </Box>
                
            </Modal>
            <Modal
                     open={rowToActivate} onClose={() => setRowsToActivate(null)}
                  >
                    <Box sx={{ ...style, width: 300, overflowY: "auto" }}>
                      {rowToActivate?.is_active ?
                        <>
                          <Stack
                            justifyContent='center'
                            alignItems='centar'
                          >
                            <Typography textAlign='center'>
                              Želite li deaktivirati partnera
                            </Typography>
                            <Button
                              variant='contained'
                              color="error"
                              onClick={()=>handleActivate(false)}
                              sx={{
                                mt:3
                              }}
                              >
                              DEAKTIVIRAJ
                            </Button>
                          </Stack>
                        </>
                        :
                        <>
                          <Stack
                            justifyContent='center'
                            alignItems='centar'
                          >
                            <Typography textAlign='center'>
                              Želite li aktivirati partnera
                            </Typography>
                            <Button
                              variant='contained'
                              color="success"
                              onClick={()=>handleActivate(true)}
                              sx={{
                                mt:3
                              }}
                              >
                              AKTIVIRAJ
                            </Button>
                          </Stack>
                        </>
                      }
            
                    </Box>
                  </Modal>
        </>    
    )
}