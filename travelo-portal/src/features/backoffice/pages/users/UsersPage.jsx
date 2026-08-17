import axios from "axios";
import { Alert, Box, Button, Checkbox, Drawer, Grid, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useState } from "react";
import { authSliceData, resetAuthData, setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";


export default function UsersPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const authData = useSelector(authSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    const [newData, setNewData] = useState({})
    const [editedData, setEditedData] = useState({})
    const [addError, setAddError] = useState("")
    const [editError, setEditError] = useState("")

    // Jezgra odbija duplu oznaku ili šifru statusom 208; bez ovoga bi forma
    // izgledala kao da je spremila, a zapis ne bi bio promijenjen.
    const rejectionMessage = (payload) => {
        const result = payload?.result
        if (!result || result.status === undefined) return ""
        if (result.status === 201 || result.status === 202 || result.status === 200) return ""
        const msg = String(result.msg || "")
        if (msg.startsWith('Code')) return t('backoffice.users.code_taken')
        if (msg.startsWith('Mark')) return t('backoffice.users.mark_taken')
        if (msg.startsWith('User')) return t('backoffice.users.username_taken')
        return msg || t('backoffice.users.save_failed')
    }

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o korisnicima'}))
        await dispatch(getBackofficeThunk({path:'users'}))
        await dispatch(getBackofficeThunk({path:'payment_methods'}))
        //await dispatch(getBackofficeThunk({path:'portal_modules'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }
    
    const api = axios.create({
        baseURL: authData.backendURL,
        withCredentials: true, // 🔑 OBAVEZNO za cookie
        headers: {
            "Content-Type": "application/json",
        },
    });

    const handleMe = async()=>{
        const responseME = await api.get("/auth/login/me")
        if(responseME.status === 200){
            await dispatch(setAuthData({path:'loggedUserData', value: responseME.data.data}));
        }else{
            await dispatch(resetAuthData({path:'loggedUserData'}));
        }
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
        setAddError("")
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog korisnika'}))
        const res = await dispatch(postBackofficeThunk({path:'users', data:newData}))
        await dispatch(setAuthData({path:'loading', value:false}))
        const rejected = rejectionMessage(res?.payload)
        if(rejected){
            setAddError(rejected)
            return
        }
        setNewData({})
        setOpenAdd(false)
        await handleMe()
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        console.log(right)

        setEditError("")
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o korinisku'}))
        const res = await dispatch(patchBackofficeThunk({path:'users', data:editedData}))
        await dispatch(setAuthData({path:'loading', value:false}))
        const rejected = rejectionMessage(res?.payload)
        if(rejected){
            setEditError(rejected)
            return
        }
        setEditedData({})
        setSelectedRow(null)
        await handleMe()
    }

    function not(a, b) {
        return a.filter((value) => b.indexOf(value) === -1);
    }

    function intersection(a, b) {
        return a.filter((value) => b.indexOf(value) !== -1);
    }

    const [checked, setChecked] = useState([]);

    const [left, setLeft] = useState([])
    const [right, setRight] = useState([])

    const leftChecked = intersection(checked, left);
    const rightChecked = intersection(checked, right);

    const handleToggle = (value) => () => {
        const currentIndex = checked.indexOf(value);
        const newChecked = [...checked];

        if (currentIndex === -1) {
        newChecked.push(value);
        } else {
        newChecked.splice(currentIndex, 1);
        }

        setChecked(newChecked);
    };

    const handleAllRight = () => {
        setRight(right.concat(left));
        setLeft([]);
        setEditedData(prev => ({
            ...prev,
            permissions: (right.concat(left))
        }));
    };

    const handleCheckedRight = () => {
        setRight(right.concat(leftChecked));
        setLeft(not(left, leftChecked));
        setChecked(not(checked, leftChecked));
        setEditedData(prev => ({
            ...prev,
            permissions: (right.concat(leftChecked))
        }));
    };

    const handleCheckedLeft = () => {
        setLeft(left.concat(rightChecked));
        setRight(not(right, rightChecked));
        setChecked(not(checked, rightChecked));
        setEditedData(prev => ({
            ...prev,
            permissions: (not(right, rightChecked))
        }));
    };

    const handleAllLeft = () => {
        setLeft(left.concat(right));
        setRight([]);
        setEditedData(prev => ({
            ...prev,
            permissions: []
        }));
    };

     const customList = (items) => (
        <Paper sx={{ width: 200, height: 230, overflow: 'auto' }}>
        <List dense component="div" role="list">
            {items.map((value) => {
            const labelId = `transfer-list-item-${value}-label`;

            return (
                <ListItemButton
                key={value.id}
                role="listitem"
                onClick={handleToggle(value)}
                >
                <ListItemIcon>
                    <Checkbox
                    checked={checked.indexOf(value) !== -1}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{
                        'aria-labelledby': labelId,
                    }}
                    />
                </ListItemIcon>
                <ListItemText id={labelId} primary={value.module_name} />
                </ListItemButton>
            );
            })}
        </List>
        </Paper>
    );

    useEffect(()=>{
        if(selectedRow){
        setEditedData(selectedRow)
        const forLeft = (backofficeData.web_portal_modules.filter(d => !selectedRow?.permissions.some(s => s.module_acr === d.module_acr)))
        const forRight = (backofficeData.web_portal_modules.filter(d => selectedRow?.permissions.some(s => s.module_acr === d.module_acr)))
        setLeft(forLeft)
        setRight(forRight)}
     },[selectedRow])

    const handleToggleActive = async (row) => {
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value: row.is_active ? 'Deaktivacija korisnika' : 'Aktivacija korisnika'}))
        await dispatch(patchBackofficeThunk({path:'users', data:{ ...row, is_active: !row.is_active }}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const rowActions = useRowClickActions({
        onEdit: (row) => setSelectedRow(row),
        onToggle: handleToggleActive,
    })

     const columns = [
        { field: 'name', headerName:t('backoffice.users.name'), flex: 2},
        { field: 'surname', headerName:t('backoffice.users.surname'), flex: 2},
        { field: 'legal_id', headerName: t('backoffice.users.legal_id'), flex: 2},
        { field: 'username', headerName:t('backoffice.users.username'), flex: 2 },
        { field: 'mark', headerName: t('backoffice.users.mark'), flex: 2 },
        { field: 'code', headerName:t('backoffice.users.code'), flex: 2 },
        { field: 'saop_clerk_id', headerName: 'SAOP ID', flex: 2 },
        { field: 'is_active', type:'boolean', headerName:t('backoffice.users.is_active'), flex: 2},
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
                        rows={backofficeData.backofficeData.users || ''}
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
                        {t('backoffice.users.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAdd(false)}>{t('backoffice.users.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.name')}
                        placeholder={t('backoffice.users.name')}
                        required
                        value={newData.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.surname')}
                        placeholder={t('backoffice.users.surname')}
                        required
                        value={newData.surname || ""}
                        onChange={handleChange}
                        name="surname"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.legal_id')}
                        placeholder={t('backoffice.users.legal_id')}
                        required
                        value={newData.legal_id || ""}
                        onChange={handleChange}
                        name="legal_id"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.username')}
                        placeholder={t('backoffice.users.username')}
                        required
                        value={newData.username || ""}
                        onChange={handleChange}
                        name="username"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.password')}
                        placeholder={t('backoffice.users.password')}
                        required
                        value={newData.password || ""}
                        onChange={handleChange}
                        name="password"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.mark')}
                        placeholder={t('backoffice.users.mark')}
                        required
                        value={newData.mark || ""}
                        onChange={handleChange}
                        name="mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        select
                        label={t('backoffice.users.is_company_employee')}
                        placeholder={t('backoffice.users.is_company_employee')}
                        required
                        value={newData.is_company_employee || ""}
                        onChange={handleChange}
                        name="is_company_employee"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value={true} >{t('backoffice.users.is_company_yes')}</MenuItem>
                        <MenuItem value={false}>{t('backoffice.users.is_company_no')}</MenuItem>
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.code')}
                        placeholder="npr. 1234"
                        helperText={t('backoffice.users.code_helper')}
                        value={newData.code || ""}
                        onChange={handleChange}
                        name="code"
                        sx={{ mt:1 }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="SAOP ID"
                        placeholder="npr. 0000046"
                        value={newData.saop_clerk_id || ""}
                        onChange={handleChange}
                        name="saop_clerk_id"
                        sx={{ mt:1 }}
                    />
                    {addError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setAddError("")}>{addError}</Alert>}
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={
                            !newData.name 
                            || !newData.legal_id
                            || !newData.username
                            || !newData.password
                            || !newData.mark
                            || !newData.is_company_employee
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.users.add_button')}
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
                        {t('backoffice.users.edit_title')}
                    </Typography>
                    <Button onClick={()=>setSelectedRow(null)}>{t('backoffice.users.close')}</Button>
                </Stack>
                   <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.name')}
                        placeholder={t('backoffice.users.name')}
                        required
                        value={editedData?.name || ""}
                        onChange={handleChangeEdit}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.surname')}
                        placeholder={t('backoffice.users.surname')}
                        required
                        value={editedData?.surname || ""}
                        onChange={handleChangeEdit}
                        name="surname"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.users.legal_id')}
                        placeholder={t('backoffice.users.legal_id')}
                        required
                        value={editedData?.legal_id || ""}
                        name="legal_id"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.users.username')}
                        placeholder={t('backoffice.users.username')}
                        required
                        value={editedData?.username || ""}
                        name="username"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="password"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.password')}
                        placeholder={t('backoffice.users.password')}
                        required
                        value={editedData?.password || ""}
                        onChange={handleChangeEdit}
                        name="password"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.mark')}
                        placeholder={t('backoffice.users.mark')}
                        required
                        value={editedData?.mark || ""}
                        onChange={handleChangeEdit}
                        name="mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="boolean"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.users.is_company_employee')}
                        placeholder={t('backoffice.users.is_company_employee')}
                        required
                        value={editedData?.is_company_employee || ""}
                        name="is_company_employee"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.users.code')}
                        placeholder="npr. 1234"
                        helperText={t('backoffice.users.code_helper')}
                        value={editedData?.code || ""}
                        onChange={handleChangeEdit}
                        name="code"
                        sx={{ mt:1 }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label="SAOP ID"
                        placeholder="npr. 0000046"
                        value={editedData?.saop_clerk_id || ""}
                        onChange={handleChangeEdit}
                        name="saop_clerk_id"
                        sx={{ mt:1 }}
                    />
                    <Stack
                        direction='row'
                        alignItems="center"
                        sx={{
                            mt:2,
                            overflowX: "auto"
                        }}
                        justifyContent='center'
                    >
                    <Grid sx={{minWidth:200}}>{customList(left)}</Grid>
                    <Stack
                        direction='column'
                        sx={{
                            mx:2,
                            minWidth:60
                        }}
                    >

                        <Button
                            sx={{ my: 0.5 }}
                            variant="outlined"
                            size="small"
                            onClick={handleAllRight}
                            disabled={left.length === 0}
                            aria-label="move all right"
                            >
                            ≫
                        </Button>
                        <Button
                            sx={{ my: 0.5}}
                            variant="outlined"
                            size="small"
                            onClick={handleCheckedRight}
                            disabled={leftChecked.length === 0}
                            aria-label="move selected right"
                            >
                            &gt;
                        </Button>
                        <Button
                            sx={{ my: 0.5 }}
                            variant="outlined"
                            size="small"
                            onClick={handleCheckedLeft}
                            disabled={rightChecked.length === 0}
                            aria-label="move selected left"
                            >
                            &lt;
                        </Button>
                        <Button
                            sx={{ my: 0.5 }}
                            variant="outlined"
                            size="small"
                            onClick={handleAllLeft}
                            disabled={right.length === 0}
                            aria-label="move all left"
                            >
                            ≪
                        </Button>
                    </Stack>
                    <Grid sx={{minWidth:200}}>{customList(right)}</Grid>
                    </Stack>
                    {editError && <Alert severity="error" sx={{ mt: 3 }} onClose={() => setEditError("")}>{editError}</Alert>}
                    <Button
                        type="submit"
                        onClick={handleSubmitEdit}
                        sx={{ height: 60, mt: 4, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.users.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>setOpenAdd(true)}>
                    {t('backoffice.users.add_employee')}
                </Button>
            </Stack>
        </>    
    )
}