import { Alert, Box, Button, Checkbox, Drawer, Grid, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk, postBackofficeThunk } from "../../backofficeSlice";
import { useT } from "../../../../i18n/useT";
import { useEffect, useMemo, useState } from "react";
import { authSliceData, setAuthData } from "../../../auth/authSlice";
import GridHint from "../../../../helpers/GridHint";
import { useRowClickActions } from "../../../../helpers/gridRowActions";
// Linije su u boat modulu, ne u backofficeu — ovdje trebaju samo kao šifarnik
// za popis linija koje se uređaju zabranjuju.
import { boatSliceData, getBoatThunk } from "../../../boat/boatSlice";


export default function BillingDevicesPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const boatData = useSelector(boatSliceData)
    const authData = useSelector(authSliceData)
    const { t } = useT();

    const [selectedRow, setSelectedRow] = useState(null)
    const [openAdd, setOpenAdd] = useState(false)
    // Novi uređaj je po defaultu aktivan. Bez toga bi izbornik ostao prazan, a
    // is_active se ne bi poslao — stupac ne dopušta NULL pa se uređaj ne bi ni
    // kreirao, a forma bi se svejedno zatvorila.
    const NEW_DEVICE_DEFAULTS = { is_active: 'true' }
    const [newData, setNewData] = useState(NEW_DEVICE_DEFAULTS)
    const [editedData, setEditedData] = useState({})

    // Modeli uređaja i zaliha serijskih brojeva — read-only, izvan redux slicea
    // jer ih koristi samo ova forma.
    const [deviceModels, setDeviceModels] = useState([])
    const [serialNumbers, setSerialNumbers] = useState([])
    const [serialNumbersEdit, setSerialNumbersEdit] = useState([])
    const [tidError, setTidError] = useState("")
    const [tidLoading, setTidLoading] = useState(false)
    const [otpLoading, setOtpLoading] = useState(false)
    const [otpEditLoading, setOtpEditLoading] = useState(false)
    const [otpEditError, setOtpEditError] = useState("")

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
    }), [authData.backendURL])

    const selectedModel = deviceModels.find((m) => m.code === newData.device_model) || null
    const selectedModelEdit = deviceModels.find((m) => m.code === editedData?.device_model) || null
    const modelNameByCode = (code) => deviceModels.find((m) => m.code === code)?.name || code || ""

    // Gateway odmata jedan sloj odgovora, pa polje može doći i top-level i pod .data.
    const unwrap = (resp, key) => resp?.data?.[key] ?? resp?.data?.data?.[key] ?? null

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o naplatnim uređajima'}))
        await dispatch(getBackofficeThunk({path:'billing_devices'}))
        await dispatch(getBackofficeThunk({path:'business_premises'}))
        await dispatch(getBackofficeThunk({path:'payment_methods'}))
        await dispatch(getBackofficeThunk({path:'users'}))
        await dispatch(getBoatThunk({path:'lines'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }
    
    useEffect(()=>{
        syncData()
    },[])

    // Popis modela je fiksan na backendu; dohvaća se jednom.
    useEffect(()=>{
        let active = true
        api.get('/portal/backoffice/device_models')
            .then((r) => { if (active) setDeviceModels(unwrap(r, 'device_models') || []) })
            .catch(() => { if (active) setDeviceModels([]) })
        return () => { active = false }
    },[api])

    // Slobodni serijski brojevi za odabrani model.
    useEffect(()=>{
        const code = newData.device_model
        const model = deviceModels.find((m) => m.code === code)
        if (!code || !model?.has_serial_numbers) { setSerialNumbers([]); return }
        let active = true
        api.get('/portal/backoffice/device_serial_numbers', { params: { model: code, only_free: 1 } })
            .then((r) => { if (active) setSerialNumbers(unwrap(r, 'device_serial_numbers') || []) })
            .catch(() => { if (active) setSerialNumbers([]) })
        return () => { active = false }
    },[api, newData.device_model, deviceModels])

    // Za uređivanje traži slobodne SN-ove, ali uključi i onaj koji je već na ovom
    // uređaju — inače bi ispao iz popisa i izgledao kao da je obrisan.
    useEffect(()=>{
        const code = editedData?.device_model
        const model = deviceModels.find((m) => m.code === code)
        if (!code || !model?.has_serial_numbers) { setSerialNumbersEdit([]); return }
        let active = true
        api.get('/portal/backoffice/device_serial_numbers', {
            params: { model: code, only_free: 1, include: editedData?.serial_number || '' },
        })
            .then((r) => { if (active) setSerialNumbersEdit(unwrap(r, 'device_serial_numbers') || []) })
            .catch(() => { if (active) setSerialNumbersEdit([]) })
        return () => { active = false }
    },[api, editedData?.device_model, editedData?.serial_number, deviceModels])

    const handleChange = async (e) => {
        setNewData({...newData, [e.target.name] : e.target.value})
    };

    // Promjena modela pri uređivanju poništava odabrani serijski broj.
    const handleChangeModelEdit = (e) => {
        setEditedData({ ...editedData, device_model: e.target.value, serial_number: "" })
    };

    // Promjena tipa poništava TID i sve što je vezano uz mobilnu blagajnu —
    // TID nosi oznaku tipa pa bi zadržani broj bio kriv.
    const handleChangeType = (e) => {
        setTidError("")
        setNewData({
            ...newData,
            type: e.target.value,
            tid: "",
            device_model: "",
            serial_number: "",
        })
    };

    // Model bez zalihe SN-ova (ili promjena modela) poništava odabrani serijski broj.
    const handleChangeModel = (e) => {
        setNewData({ ...newData, device_model: e.target.value, serial_number: "" })
    };

    const handleGenerateTid = async () => {
        setTidError("")
        setTidLoading(true)
        try {
            const r = await api.get('/portal/backoffice/billing_devices/next_tid', { params: { type: newData.type } })
            const tid = unwrap(r, 'tid')
            if (tid) setNewData((prev) => ({ ...prev, tid }))
            else setTidError("TID nije vraćen.")
        } catch (e) {
            setTidError(e?.response?.data?.error || e.message || "Generiranje TID-a nije uspjelo.")
        } finally {
            setTidLoading(false)
        }
    };

    // OTP: 6 znakova (mala slova + znamenke). Generira backend da provjeri
    // da kod nije već u upotrebi na nekom uređaju.
    const fetchOtp = async () => {
        const r = await api.get('/portal/backoffice/billing_devices/next_otp')
        const otp = unwrap(r, 'otp')
        if (!otp) throw new Error("OTP nije vraćen.")
        return otp
    };

    const handleGenerateOtp = async () => {
        setTidError("")
        setOtpLoading(true)
        try {
            const otp = await fetchOtp()
            setNewData((prev) => ({ ...prev, otp }))
        } catch (e) {
            setTidError(e?.response?.data?.error || e.message || "Generiranje OTP-a nije uspjelo.")
        } finally {
            setOtpLoading(false)
        }
    };

    // Isti generator u drawer-u za uređivanje — novi OTP se sprema tek klikom
    // na "Ažuriraj", jer ide kroz isti patch kao i ostala polja.
    const handleGenerateOtpEdit = async () => {
        setOtpEditError("")
        setOtpEditLoading(true)
        try {
            const otp = await fetchOtp()
            setEditedData((prev) => ({ ...prev, otp }))
        } catch (e) {
            setOtpEditError(e?.response?.data?.error || e.message || "Generiranje OTP-a nije uspjelo.")
        } finally {
            setOtpEditLoading(false)
        }
    };
    const handleChangeEdit = async (e) => {
        setEditedData({...editedData, [e.target.name] : e.target.value})
    };

    const handleSubmit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje novog naplatnog uređaja'}))
        await dispatch(postBackofficeThunk({path:'billing_devices', data:newData}))
        setNewData(NEW_DEVICE_DEFAULTS)
        setOpenAdd(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const handleSubmitEdit = async(e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o naplatnog uređaja'}))
        await dispatch(patchBackofficeThunk({path:'billing_devices', data:editedData}))
        setEditedData({})
        setSelectedRow(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

     useEffect(()=>{
        setEditedData(selectedRow)
        setOtpEditError("")
     },[selectedRow])



    // Zajednički okvir za sve tri prijenosne liste (plaćanja, operateri, linije).
    // Naslov stoji u traci iznad popisa, s brojem stavki, da se na prvi pogled
    // vidi koja je strana koja — prije su bila dva gola okvira bez ijedne oznake.
    const transferOkvir = (naslov, items, sadrzaj) => (
        <Paper
            variant="outlined"
            sx={{
                flex: 1,
                minWidth: 0,
                borderWidth: 2,
                borderRadius: 2,
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    px: 1.5, py: 0.75,
                    bgcolor: 'action.hover',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    gap: 0.75,
                }}
            >
                <Typography variant="subtitle2" fontWeight={700} noWrap>{naslov}</Typography>
                <Typography variant="caption" color="text.secondary">({items.length})</Typography>
            </Box>
            <Box sx={{ height: 280, overflow: 'auto' }}>
                {items.length ? sadrzaj : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                        Nema stavki
                    </Typography>
                )}
            </Box>
        </Paper>
    );

    // Stupac sa strelicama je uvijek isti, mijenjaju se samo rukovatelji.
    const transferStrelice = (svedesno, desno, lijevo, sveLijevo, mozeSveDesno, mozeDesno, mozeLijevo, mozeSveLijevo) => (
        <Stack direction='column' sx={{ mx: 2, minWidth: 60 }}>
            <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={svedesno} disabled={!mozeSveDesno} aria-label="move all right">≫</Button>
            <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={desno} disabled={!mozeDesno} aria-label="move selected right">&gt;</Button>
            <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={lijevo} disabled={!mozeLijevo} aria-label="move selected left">&lt;</Button>
            <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={sveLijevo} disabled={!mozeSveLijevo} aria-label="move all left">≪</Button>
        </Stack>
    );

    const transferRed = (sadrzaj) => (
        <Stack
            direction='row'
            alignItems="stretch"
            sx={{ mt: 1, mb: 1, width: '100%' }}
            justifyContent='center'
        >
            {sadrzaj}
        </Stack>
    );

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
            payment: (right.concat(left))
        }));
    };

    const handleCheckedRight = () => {
        setRight(right.concat(leftChecked));
        setLeft(not(left, leftChecked));
        setChecked(not(checked, leftChecked));
        setEditedData(prev => ({
            ...prev,
            payment: (right.concat(leftChecked))
        }));
    };

    const handleCheckedLeft = () => {
        setLeft(left.concat(rightChecked));
        setRight(not(right, rightChecked));
        setChecked(not(checked, rightChecked));
        setEditedData(prev => ({
            ...prev,
            payment: (not(right, rightChecked))
        }));
    };

    const handleAllLeft = () => {
        setLeft(left.concat(right));
        setRight([]);
        setEditedData(prev => ({
            ...prev,
            payment: []
        }));
    };

     const customList = (items) => (
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
                <ListItemText id={labelId} primary={value.name} />
                </ListItemButton>
            );
            })}
        </List>
    );

    //OPERATORS

    const [checkedOP, setCheckedOP] = useState([]);

    const [leftOP, setLeftOP] = useState([])
    const [rightOP, setRightOP] = useState([])

    const leftCheckedOP = intersection(checkedOP, leftOP);
    const rightCheckedOP = intersection(checkedOP, rightOP);

    const handleToggleOP = (value) => () => {
        const currentIndex = checkedOP.indexOf(value);
        const newChecked = [...checkedOP];

        if (currentIndex === -1) {
        newChecked.push(value);
        } else {
        newChecked.splice(currentIndex, 1);
        }

        setCheckedOP(newChecked);
    };

    const handleAllRightOP = () => {
        setRightOP(rightOP.concat(leftOP));
        setLeftOP([]);
        setEditedData(prev => ({
            ...prev,
            permissions: (rightOP.concat(leftOP))
        }));
    };

    const handleCheckedRightOP = () => {
        setRightOP(rightOP.concat(leftCheckedOP));
        setLeftOP(not(leftOP, leftCheckedOP));
        setCheckedOP(not(checkedOP, leftCheckedOP));
        setEditedData(prev => ({
            ...prev,
            permissions: (rightOP.concat(leftCheckedOP))
        }));
    };

    const handleCheckedLeftOP = () => {
        setLeftOP(leftOP.concat(rightCheckedOP));
        setRightOP(not(rightOP, rightCheckedOP));
        setCheckedOP(not(checkedOP, rightCheckedOP));
        setEditedData(prev => ({
            ...prev,
            permissions: (not(rightOP, rightCheckedOP))
        }));
    };

    const handleAllLeftOP = () => {
        setLeftOP(leftOP.concat(rightOP));
        setRightOP([]);
        setEditedData(prev => ({
            ...prev,
            permissions: []
        }));
    };

     const customListOP = (items) => (
        <List dense component="div" role="list">
            {items.map((value) => {
            const labelId = `transfer-list-item-${value}-label`;

            return (
                <ListItemButton
                key={value.id}
                role="listitem"
                onClick={handleToggleOP(value)}
                >
                <ListItemIcon>
                    <Checkbox
                    checked={checkedOP.indexOf(value) !== -1}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{
                        'aria-labelledby': labelId,
                    }}
                    />
                </ListItemIcon>
                <ListItemText id={labelId} primary={value.name + ' ' + value.surname} />
                </ListItemButton>
            );
            })}
        </List>
    );

    //LINIJE — desna strana su ZABRANJENE linije (sve su dozvoljene dok se ne
    //makne na desno), pa se u editedData sprema desna lista.

    const [checkedLN, setCheckedLN] = useState([]);

    const [leftLN, setLeftLN] = useState([])
    const [rightLN, setRightLN] = useState([])

    const leftCheckedLN = intersection(checkedLN, leftLN);
    const rightCheckedLN = intersection(checkedLN, rightLN);

    const handleToggleLN = (value) => () => {
        const currentIndex = checkedLN.indexOf(value);
        const newChecked = [...checkedLN];

        if (currentIndex === -1) {
        newChecked.push(value);
        } else {
        newChecked.splice(currentIndex, 1);
        }

        setCheckedLN(newChecked);
    };

    // Linije se u editedData spremaju samo s poljima koja backoffice zapisuje,
    // da se cijeli objekt linije ne vuče kroz PATCH.
    const linesForSave = (items) => items.map((l) => ({ uuid:l.uuid, name:l.name, code:l.code }))

    const handleAllRightLN = () => {
        const noviDesno = rightLN.concat(leftLN)
        setRightLN(noviDesno);
        setLeftLN([]);
        setEditedData(prev => ({ ...prev, excluded_lines: linesForSave(noviDesno) }));
    };

    const handleCheckedRightLN = () => {
        const noviDesno = rightLN.concat(leftCheckedLN)
        setRightLN(noviDesno);
        setLeftLN(not(leftLN, leftCheckedLN));
        setCheckedLN(not(checkedLN, leftCheckedLN));
        setEditedData(prev => ({ ...prev, excluded_lines: linesForSave(noviDesno) }));
    };

    const handleCheckedLeftLN = () => {
        const noviDesno = not(rightLN, rightCheckedLN)
        setLeftLN(leftLN.concat(rightCheckedLN));
        setRightLN(noviDesno);
        setCheckedLN(not(checkedLN, rightCheckedLN));
        setEditedData(prev => ({ ...prev, excluded_lines: linesForSave(noviDesno) }));
    };

    const handleAllLeftLN = () => {
        setLeftLN(leftLN.concat(rightLN));
        setRightLN([]);
        setEditedData(prev => ({ ...prev, excluded_lines: [] }));
    };

    const customListLN = (items) => (
        <List dense component="div" role="list">
            {items.map((value) => {
            const labelId = `transfer-list-item-${value}-label`;

            return (
                <ListItemButton
                key={value.id}
                role="listitem"
                onClick={handleToggleLN(value)}
                >
                <ListItemIcon>
                    <Checkbox
                    checked={checkedLN.indexOf(value) !== -1}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{
                        'aria-labelledby': labelId,
                    }}
                    />
                </ListItemIcon>
                <ListItemText id={labelId} primary={value.code ? `${value.code} · ${value.name}` : value.name} />
                </ListItemButton>
            );
            })}
        </List>
    );


    useEffect(()=>{
        if(selectedRow){
        setEditedData(selectedRow)
        console.log(selectedRow)
        const forLeft = (backofficeData.backofficeData.payment_methods.filter(d => !selectedRow?.payment.some(s => s.uuid === d.uuid)))
        const forRight = (backofficeData.backofficeData.payment_methods.filter(d => selectedRow?.payment.some(s => s.uuid === d.uuid)))
        const forLeftOP = (backofficeData.backofficeData.users.filter(d => !selectedRow?.permissions.some(s => s.uuid === d.uuid)))
        const forRightOP = (backofficeData.backofficeData.users.filter(d => selectedRow?.permissions.some(s => s.uuid === d.uuid)))
        // Linije: desno stoje ZABRANJENE. Obrnuto od druge dvije liste, jer su
        // linije po pravilu sve dozvoljene pa se pamti samo iznimka.
        const excluded = selectedRow?.excluded_lines || []
        const lines = boatData.boatData.lines || []
        setLeft(forLeft)
        setRight(forRight)
        setLeftOP(forLeftOP)
        setRightOP(forRightOP)
        setLeftLN(lines.filter(d => !excluded.some(s => s.uuid === d.uuid)))
        setRightLN(lines.filter(d => excluded.some(s => s.uuid === d.uuid)))
    }
    },[selectedRow])

    const handleToggleActive = async (row) => {
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value: row.is_active ? 'Deaktivacija naplatnog uređaja' : 'Aktivacija naplatnog uređaja'}))
        await dispatch(patchBackofficeThunk({path:'billing_devices', data:{ ...row, is_active: !row.is_active }}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const rowActions = useRowClickActions({
        onEdit: (row) => setSelectedRow(row),
        onToggle: handleToggleActive,
    })

     const columns = [
        { field: 'name', headerName:t('backoffice.billing_devices.name') , flex: 4},
        { field: 'fiscal_mark', headerName:t('backoffice.billing_devices.fiscal_mark') , flex: 2},
        { field: 'business_premise_name', headerName:t('backoffice.billing_devices.business_premises') , flex: 2 },
        { field: 'cost_center', headerName:t('backoffice.billing_devices.cost_center') , flex: 2 },
        { field: 'tid', headerName:t('backoffice.billing_devices.tid') , flex: 2 },
        { field: 'otp', headerName:t('backoffice.billing_devices.otp') , flex: 2},
        { field: 'description', headerName:t('backoffice.billing_devices.description'), flex: 3 },
        { field: 'type', headerName:t('backoffice.billing_devices.type'), flex: 2 },
        { field: 'device_model', headerName:t('backoffice.billing_devices.device_model'), flex: 2,
            valueGetter: (_v, row) => modelNameByCode(row.device_model) },
        { field: 'serial_number', headerName:t('backoffice.billing_devices.serial_number'), flex: 2 },
        { field: 'auto_validate', type: 'boolean', headerName:t('backoffice.billing_devices.auto_validate'), flex: 2},
        { field: 'auto_pair', type: 'boolean', headerName: 'Auto uparivanje', flex: 2},
        { field: 'is_active', type: 'boolean', headerName:t('backoffice.billing_devices.is_active'), flex: 2},
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
                        rows={backofficeData.backofficeData.billing_devices || ''}
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
                        {t('backoffice.billing_devices.add_new_title')}
                    </Typography>
                    <Button onClick={()=>setOpenAdd(false)}>{t('backoffice.billing_devices.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.name')}
                        placeholder={t('backoffice.billing_devices.name')}
                        required
                        value={newData.name || ""}
                        onChange={handleChange}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.mark')}
                        placeholder={t('backoffice.billing_devices.mark')}
                        required
                        value={newData.mark || ""}
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
                        label={t('backoffice.billing_devices.fiscal_mark')}
                        placeholder={t('backoffice.billing_devices.fiscal_mark')}
                        
                        value={newData.fiscal_mark || ""}
                        onChange={handleChange}
                        name="fiscal_mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.type')}
                        placeholder={t('backoffice.billing_devices.type')}
                        select
                        required
                        value={newData.type || ""}
                        onChange={handleChangeType}
                        name="type"
                        sx={{ mt: 1 }}
                    >
                        <MenuItem value="pc">PC blagajna</MenuItem>
                        <MenuItem value="mobile">Mobilna blagajna</MenuItem>
                        <MenuItem value="web">Web prodaja</MenuItem>
                    </TextField>
                    {newData.type === 'mobile' && (
                        <>
                            <TextField
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.billing_devices.device_model')}
                                select
                                value={newData.device_model || ""}
                                onChange={handleChangeModel}
                                name="device_model"
                                sx={{ mt: 1 }}
                            >
                                {deviceModels.map((m) => (
                                    <MenuItem key={m.code} value={m.code}>{m.name}</MenuItem>
                                ))}
                            </TextField>
                            {selectedModel?.has_serial_numbers && (
                                <TextField
                                    variant="outlined"
                                    fullWidth
                                    label={t('backoffice.billing_devices.serial_number')}
                                    select
                                    value={newData.serial_number || ""}
                                    onChange={handleChange}
                                    name="serial_number"
                                    sx={{ mt: 1 }}
                                    helperText={serialNumbers.length === 0
                                        ? `Nema slobodnih serijskih brojeva za ${selectedModel.name}.`
                                        : undefined}
                                >
                                    {serialNumbers.map((sn) => (
                                        <MenuItem key={sn.uuid} value={sn.serial_number}>
                                            {sn.serial_number}{sn.description ? ` — ${sn.description}` : ""}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                        </>
                    )}
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.cost_center')}
                        placeholder={t('backoffice.billing_devices.cost_center')}
                        value={newData.cost_center || ""}
                        onChange={handleChange}
                        name="cost_center"
                        sx={{ mt: 1 }}
                    />
                    {(newData.type === 'pc' || newData.type === 'mobile') && (
                        <>
                            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
                                <TextField
                                    type="text"
                                    variant="outlined"
                                    fullWidth
                                    label={t('backoffice.billing_devices.tid')}
                                    placeholder={t('backoffice.billing_devices.tid')}
                                    required
                                    value={newData.tid || ""}
                                    onChange={handleChange}
                                    name="tid"
                                />
                                <Button
                                    variant="outlined"
                                    onClick={handleGenerateTid}
                                    disabled={tidLoading}
                                    sx={{ height: 56, whiteSpace: "nowrap", flexShrink: 0 }}
                                >
                                    {tidLoading ? "Generiram…" : "Generiraj"}
                                </Button>
                            </Stack>
                            {tidError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setTidError("")}>{tidError}</Alert>}
                            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
                                <TextField
                                    type="text"
                                    variant="outlined"
                                    fullWidth
                                    label={t('backoffice.billing_devices.otp')}
                                    placeholder={t('backoffice.billing_devices.otp')}
                                    required
                                    value={newData.otp || ""}
                                    onChange={handleChange}
                                    name="otp"
                                />
                                <Button
                                    variant="outlined"
                                    onClick={handleGenerateOtp}
                                    disabled={otpLoading}
                                    sx={{ height: 56, whiteSpace: "nowrap", flexShrink: 0 }}
                                >
                                    {otpLoading ? "Generiram…" : "Generiraj"}
                                </Button>
                            </Stack>
                        </>
                    )}
                    {newData.type === 'mobile' && (
                        <TextField
                            variant="outlined"
                            fullWidth
                            label="Auto-validacija"
                            select
                            required
                            value={
                                newData.auto_validate === true || newData.auto_validate === 'true'
                                    ? 'true' : 'false'
                            }
                            onChange={handleChange}
                            name="auto_validate"
                            sx={{ mt: 1 }}
                        >
                            <MenuItem value="false">Ne (karta se ručno validira na ulazu)</MenuItem>
                            <MenuItem value="true">Da (karta se automatski validira pri prodaji)</MenuItem>
                        </TextField>
                    )}
                    {(newData.type === 'pc' || newData.type === 'mobile') && (
                        <TextField
                            variant="outlined"
                            fullWidth
                            label="Automatsko uparivanje"
                            select
                            value={newData.auto_pair === true || newData.auto_pair === 'true' ? 'true' : 'false'}
                            onChange={handleChange}
                            name="auto_pair"
                            sx={{ mt: 1 }}
                            helperText="Uređaj s upisanim serijskim brojem se upari sam, bez unosa TID-a i OTP-a"
                        >
                            <MenuItem value="false">Ne (ručno, TID i OTP)</MenuItem>
                            <MenuItem value="true">Da (po serijskom broju)</MenuItem>
                        </TextField>
                    )}
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.description')}
                        placeholder={t('backoffice.billing_devices.description')}
                        value={newData.description || ""}
                        onChange={handleChange}
                        name="description"
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.business_premises')}
                        placeholder={t('backoffice.billing_devices.business_premises')}
                        select
                        required
                        value={newData.business_premises || ""}
                        onChange={handleChange}
                        name="business_premises"
                        sx={{
                            mt:1
                        }}
                        >
                        {backofficeData.backofficeData.business_premises.map((bp)=>(
                            <MenuItem key={bp.id} value={bp}>{bp.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.is_active')}
                        placeholder={t('backoffice.billing_devices.is_active')}
                        select
                        value={newData.is_active || ""}
                        onChange={handleChange}
                        name="is_active"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value='true'>{t('backoffice.billing_devices.is_active_yes')}</MenuItem>
                        <MenuItem value='false'>{t('backoffice.billing_devices.is_active_no')}</MenuItem>
                    </TextField>
                    <Button
                        type="submit"
                        
                        onClick={handleSubmit}
                        disabled={
                            !newData.name
                            || !newData.fiscal_mark
                            || !newData.type
                            || !newData.business_premises
                            // TID i OTP postoje samo za PC i mobilnu blagajnu — za web
                            // prodaju se polja ni ne prikazuju, pa ih ne smijemo tražiti
                            // (inače gumb ostane trajno onemogućen).
                            || ((newData.type === 'pc' || newData.type === 'mobile')
                                && (!newData.tid || !newData.otp))
                        }
                        sx={{ height: 60, mt: 2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.billing_devices.add_button')}
                    </Button>
                </Box>
            </Drawer>
            {/* Širi od forme za dodavanje: ovdje stoje tri prijenosne liste,
                a dvije kolone od 680 px ispadaju preuske za nazive linija. */}
            <Drawer
                anchor="right"
                open={selectedRow}
                onClose={() => setSelectedRow(null)}
                PaperProps={{
                sx: { width: { xs: "100vw", sm: 560, md: 820, lg: 900 }, maxWidth: "100vw" },
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
                            {t('backoffice.billing_devices.edit_title')}
                    </Typography>
                    <Button onClick={()=>setSelectedRow(null)}>{t('backoffice.billing_devices.close')}</Button>
                </Stack>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.name')}
                        placeholder={t('backoffice.billing_devices.name')}
                        required
                        value={editedData?.name || ""}
                        onChange={handleChangeEdit}
                        name="name"
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.billing_devices.mark')}
                        placeholder={t('backoffice.billing_devices.mark')}
                        required
                        value={editedData?.mark || ""}
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
                        label={t('backoffice.billing_devices.fiscal_mark')}
                        placeholder={t('backoffice.billing_devices.fiscal_mark')}
                        value={editedData?.fiscal_mark || ""}
                        name="fiscal_mark"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.billing_devices.cost_center')}
                        placeholder={t('backoffice.billing_devices.cost_center')}
                        value={editedData?.cost_center || ""}
                        name="cost_center"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.billing_devices.tid')}
                        placeholder={t('backoffice.billing_devices.tid')}
                        required
                        value={editedData?.tid || ""}
                        name="tid"
                        sx={{
                            mt:1
                        }}
                    />
                    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
                        <TextField
                            type="text"
                            variant="outlined"
                            fullWidth
                            label={t('backoffice.billing_devices.otp')}
                            placeholder={t('backoffice.billing_devices.otp')}
                            required
                            value={editedData?.otp || ""}
                            onChange={handleChangeEdit}
                            name="otp"
                        />
                        <Button
                            variant="outlined"
                            onClick={handleGenerateOtpEdit}
                            disabled={otpEditLoading}
                            sx={{ height: 56, whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                            {otpEditLoading ? "Generiram…" : "Generiraj"}
                        </Button>
                    </Stack>
                    {otpEditError && (
                        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setOtpEditError("")}>{otpEditError}</Alert>
                    )}
                    {(editedData?.type_name === 'mobile' || editedData?.type === 'mobile') && (
                        <>
                            <TextField
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.billing_devices.device_model')}
                                select
                                value={editedData?.device_model || ""}
                                onChange={handleChangeModelEdit}
                                name="device_model"
                                sx={{ mt: 1 }}
                            >
                                {deviceModels.map((m) => (
                                    <MenuItem key={m.code} value={m.code}>{m.name}</MenuItem>
                                ))}
                            </TextField>
                            {selectedModelEdit?.has_serial_numbers && (
                                <TextField
                                    variant="outlined"
                                    fullWidth
                                    label={t('backoffice.billing_devices.serial_number')}
                                    select
                                    value={editedData?.serial_number || ""}
                                    onChange={handleChangeEdit}
                                    name="serial_number"
                                    sx={{ mt: 1 }}
                                    helperText={serialNumbersEdit.length === 0
                                        ? `Nema slobodnih serijskih brojeva za ${selectedModelEdit.name}.`
                                        : "Stari broj se oslobađa, novi se zauzima pri spremanju"}
                                >
                                    {serialNumbersEdit.map((sn) => (
                                        <MenuItem key={sn.uuid} value={sn.serial_number}>
                                            {sn.serial_number}
                                            {sn.serial_number === editedData?.serial_number ? " (trenutni)" : ""}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                        </>
                    )}
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.description')}
                        placeholder={t('backoffice.billing_devices.description')}
                        value={editedData?.description || ""}
                        onChange={handleChangeEdit}
                        name="description"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.billing_devices.type')}
                        placeholder={t('backoffice.billing_devices.type')}
                        required
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
                        label={t('backoffice.billing_devices.auto_validate')}
                        placeholder={t('backoffice.billing_devices.auto_validate')}
                        select
                        required
                        value={
                            editedData?.auto_validate === true || editedData?.auto_validate === 'true'
                                ? 'true' : 'false'
                        }
                        onChange={handleChangeEdit}
                        name="auto_validate"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value='true'>{t('backoffice.billing_devices.auto_validate_yes')}</MenuItem>
                        <MenuItem value='false'>{t('backoffice.billing_devices.auto_validate_no')}</MenuItem>
                    </TextField>
                    <TextField
                        variant="outlined"
                        fullWidth
                        label="Automatsko uparivanje"
                        select
                        value={editedData?.auto_pair === true || editedData?.auto_pair === 'true' ? 'true' : 'false'}
                        onChange={handleChangeEdit}
                        name="auto_pair"
                        sx={{ mt: 1 }}
                        helperText="Uređaj s upisanim serijskim brojem se upari sam, bez unosa TID-a i OTP-a"
                    >
                        <MenuItem value="false">Ne (ručno, TID i OTP)</MenuItem>
                        <MenuItem value="true">Da (po serijskom broju)</MenuItem>
                    </TextField>
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        disabled
                        label={t('backoffice.billing_devices.business_premises')}
                        placeholder={t('backoffice.billing_devices.business_premises')}
                        required
                        value={editedData?.business_premises || ""}
                        name="business_premises"
                        sx={{
                            mt:1
                        }}
                    />
                    <TextField
                        type="text"
                        variant="outlined"
                        fullWidth
                        label={t('backoffice.billing_devices.is_active')}
                        placeholder={t('backoffice.billing_devices.is_active')}
                        select
                        value={editedData?.is_active || ""}
                        onChange={handleChangeEdit}
                        name="is_active"
                        sx={{
                            mt:1
                        }}
                        >
                        <MenuItem value='true'>{t('backoffice.billing_devices.is_active_yes')}</MenuItem>
                        <MenuItem value='false'>{t('backoffice.billing_devices.is_active_no')}</MenuItem>
                    </TextField>
                    <Typography textAlign='center' fontWeight={700} sx={{mt:3}}>Sredstva plaćanja</Typography>
                    {transferRed(<>
                        {transferOkvir('Nije na uređaju', left, customList(left))}
                        {transferStrelice(
                            handleAllRight, handleCheckedRight, handleCheckedLeft, handleAllLeft,
                            left.length > 0, leftChecked.length > 0, rightChecked.length > 0, right.length > 0,
                        )}
                        {transferOkvir('Na uređaju', right, customList(right))}
                    </>)}
                    <Typography textAlign='center' fontWeight={700} sx={{mt:3}}>Operateri</Typography>
                    {transferRed(<>
                        {transferOkvir('Nema pristup', leftOP, customListOP(leftOP))}
                        {transferStrelice(
                            handleAllRightOP, handleCheckedRightOP, handleCheckedLeftOP, handleAllLeftOP,
                            leftOP.length > 0, leftCheckedOP.length > 0, rightCheckedOP.length > 0, rightOP.length > 0,
                        )}
                        {transferOkvir('Ima pristup', rightOP, customListOP(rightOP))}
                    </>)}
                    <Typography textAlign='center' fontWeight={700} sx={{mt:3}}>Linije</Typography>
                    <Typography textAlign='center' variant="caption" color="text.secondary" component="div">
                        Zadano uređaj vidi sve linije — desno se stavljaju one koje mu nisu dozvoljene.
                    </Typography>
                    {transferRed(<>
                        {transferOkvir('Uređaj vidi', leftLN, customListLN(leftLN))}
                        {transferStrelice(
                            handleAllRightLN, handleCheckedRightLN, handleCheckedLeftLN, handleAllLeftLN,
                            leftLN.length > 0, leftCheckedLN.length > 0, rightCheckedLN.length > 0, rightLN.length > 0,
                        )}
                        {transferOkvir('Nije dozvoljeno', rightLN, customListLN(rightLN))}
                    </>)}
                    <Button
                        type="submit"
                        onClick={handleSubmitEdit}
                        sx={{ height: 60, mt: 2, mb:2, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.billing_devices.edit_button')}
                    </Button>
                </Box>   
            </Drawer>
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={()=>{ setNewData(NEW_DEVICE_DEFAULTS); setOpenAdd(true); }}>
                    {t('backoffice.billing_devices.add_terminal')}
                </Button>
            </Stack>
        </>    
    )
}