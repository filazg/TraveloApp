import { Box, Button, Drawer, Grid, MenuItem, Modal, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useRef, useState } from "react";
import { setAuthData } from "../../../auth/authSlice";


export default function AddressbookPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    const [editedData, setEditedData] = useState({})
    const [rowToActivate, setRowsToActivate] = useState(null);

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o adresaru'}))
        await dispatch(getBackofficeThunk({path:'addressbook'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }
    
    useEffect(()=>{
        syncData()
    },[])

    const clickTimerRef = useRef(null);
    const clickDelay = 250;

    const handleActivate = async(status)=>{
        await dispatch(setAuthData({ path: "loading", value: true }));
        let message = 'Deeaktiviranje kupca'
        if(status){
            message='Aktiviranje kupca'
        }
        await dispatch(setAuthData({ path: "loadingMessage", value: message }));
        setRowsToActivate(null)
        const dataToSend = { ...rowToActivate, buyer_is_active: status };
        await dispatch(
        patchBackofficeThunk({ path: "addressbook", data: dataToSend }),
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
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog kupca'}))
        await dispatch(postBackofficeThunk({path:'addressbook', data:newData}))
        setNewData({})
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o kupcu'}))
        await dispatch(patchBackofficeThunk({path:'addressbook', data:editedData}))
        setEditedData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     useEffect(()=>{
        setEditedData(selectedRow)
     },[selectedRow])

     const columns = [
        { field: 'buyer_name', headerName:t('backoffice.addressbook.buyer_name'), flex: 2, editable: true },
        { field: 'buyer_company_name', headerName: t('backoffice.addressbook.buyer_company_name'), flex: 2, editable: true},
        { field: 'buyer_legal_id', headerName:t('backoffice.addressbook.buyer_legal_id'), flex: 2},
        { field: 'buyer_vat_id', headerName: t('backoffice.addressbook.buyer_vat_id'), flex: 2},
        { field: 'buyer_address', headerName:t('backoffice.addressbook.buyer_address'), flex: 2, editable: true},
        { field: 'buyer_postal_code', headerName: t('backoffice.addressbook.buyer_postal_code'), flex: 2, editable: true},
        { field: 'buyer_town', headerName:t('backoffice.addressbook.buyer_town'), flex: 2,  editable: true},
        { field: 'buyer_country', headerName:t('backoffice.addressbook.buyer_country'), flex: 2, editable: true},
        { field: 'buyer_email', headerName:t('backoffice.addressbook.buyer_email'), flex: 2, editable: true},
        {
              field: "buyer_is_active",
              headerName: t("backoffice.addressbook.buyer_is_active"),
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
                <Box
                    sx={{
                        height:"80vh",
                        minWidth: 1200
                    }}
                >
                    <DataGrid
                        rows={backofficeData.backofficeData.addressbook || ''}
                        columns={columns}
                        getRowId={(row) => row.id}
                        //onCellClick={(params) => setSelectedRow(params.row)}
                        onCellClick={(params) => {
                        clearTimeout(clickTimerRef.current);

                        clickTimerRef.current = setTimeout(() => {
                        setSelectedRow(params.row);
                        }, clickDelay);
                        }}
                        onCellDoubleClick={(params, event) => {
                            event.defaultMuiPrevented = true; 
                            clearTimeout(clickTimerRef.current);
                            setRowsToActivate(params.row)
                            console.log("Field:", params.field);
                            console.log("Row:", params.row);

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
                        {t('backoffice.addressbook.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAdd(false)}>{t('backoffice.addressbook.close')}</Button>
                </Stack>
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_name')}
                    placeholder={t('backoffice.addressbook.buyer_name')}
                    value={newData.buyer_name || ""}
                    onChange={handleChange}                  
                    name="buyer_name"
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_company_name')}
                    placeholder={t('backoffice.addressbook.buyer_company_name')}                    
                    value={newData.buyer_company_name || ""}
                    onChange={handleChange}
                    name="buyer_company_name"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_legal_id')}
                    placeholder={t('backoffice.addressbook.buyer_legal_id')}
                    required
                    value={newData.buyer_legal_id || ""}
                    onChange={handleChange}
                    name="buyer_legal_id"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_vat_id')}
                    placeholder={t('backoffice.addressbook.buyer_vat_id')}                    
                    value={newData.buyer_vat_id || ""}
                    onChange={handleChange}
                    name="buyer_vat_id"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_address')}
                    placeholder={t('backoffice.addressbook.buyer_address')}
                    value={newData.buyer_address || ""}
                    onChange={handleChange}
                    name="buyer_address"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_postal_code')}
                    placeholder={t('backoffice.addressbook.buyer_postal_code')}
                    value={newData.buyer_postal_code || ""}
                    onChange={handleChange}
                    name="buyer_postal_code"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_town')}
                    placeholder={t('backoffice.addressbook.buyer_town')}
                    value={newData.buyer_town || ""}
                    onChange={handleChange}
                    name="buyer_town"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_country')}
                    placeholder={t('backoffice.addressbook.buyer_country')}
                    value={newData.buyer_country || ""}
                    onChange={handleChange}
                    name="buyer_country"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_email')}
                    placeholder={t('backoffice.addressbook.buyer_email')}
                    value={newData.buyer_email || ""}
                    onChange={handleChange}
                    name="buyer_email"
                    sx={{
                        mt:1
                    }}
                />
                    <Button
                        type="submit"
                        
                        onClick={handleSubmit}
                        disabled={
                            !newData.buyer_legal_id 
                            || !newData.buyer_country
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.addressbook.add_new_title')}
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
                    label={t('backoffice.addressbook.buyer_name')}
                    placeholder={t('backoffice.addressbook.buyer_name')}
                    value={editedData?.buyer_name || ""}
                    onChange={handleChangeEdit}                  
                    name="buyer_name"
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_company_name')}
                    placeholder={t('backoffice.addressbook.buyer_company_name')}                    
                    value={editedData?.buyer_company_name || ""}
                    onChange={handleChangeEdit}
                    name="buyer_company_name"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_vat_id')}
                    placeholder={t('backoffice.addressbook.buyer_vat_id')}                    
                    value={editedData?.buyer_vat_id || ""}
                    onChange={handleChangeEdit}
                    name="buyer_vat_id"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_address')}
                    placeholder={t('backoffice.addressbook.buyer_address')}
                    value={editedData?.buyer_address || ""}
                    onChange={handleChangeEdit}
                    name="buyer_address"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_postal_code')}
                    placeholder={t('backoffice.addressbook.buyer_postal_code')}
                    value={editedData?.buyer_postal_code || ""}
                    onChange={handleChangeEdit}
                    name="buyer_postal_code"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_town')}
                    placeholder={t('backoffice.addressbook.buyer_town')}
                    value={editedData?.buyer_town || ""}
                    onChange={handleChangeEdit}
                    name="buyer_town"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_country')}
                    placeholder={t('backoffice.addressbook.buyer_country')}
                    value={editedData?.buyer_country || ""}
                    onChange={handleChangeEdit}
                    name="buyer_country"
                    sx={{
                        mt:1
                    }}
                />
                <TextField
                    type="text"
                    variant="outlined"
                    fullWidth
                    label={t('backoffice.addressbook.buyer_email')}
                    placeholder={t('backoffice.addressbook.buyer_email')}
                    value={editedData?.buyer_email || ""}
                    onChange={handleChangeEdit}
                    name="buyer_email"
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
                            {t('backoffice.addressbook.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAdd(true)}>
                    {t('backoffice.addressbook.add_new_title')}
                </Button>
            </Stack>
            <Modal
                    open={rowToActivate} onClose={() => setRowsToActivate(null)}
                >
                <Box sx={{ ...style, width: 300, overflowY: "auto" }}>
                    {rowToActivate?.buyer_is_active ?
                    <>
                        <Stack
                        justifyContent='center'
                        alignItems='centar'
                        >
                        <Typography textAlign='center'>
                            Želite li deaktivirati kupca
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
                            Želite li aktivirati kupca
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