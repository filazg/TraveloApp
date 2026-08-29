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


// Dan obračuna za tjednu dinamiku. 1 = ponedjeljak, kao u ISO tjednu, da se
// isti broj može izravno usporediti s danom u kodu koji generira obračun.
const DANI_U_TJEDNU = [
    { value: 1, label: 'Ponedjeljak' },
    { value: 2, label: 'Utorak' },
    { value: 3, label: 'Srijeda' },
    { value: 4, label: 'Četvrtak' },
    { value: 5, label: 'Petak' },
    { value: 6, label: 'Subota' },
    { value: 7, label: 'Nedjelja' },
];

// Kratak opis dinamike za popis partnera.
const opisDinamike = (cycle, weekday) => {
    if (cycle === 'SEMI_MONTHLY') return 'Dvomjesečno — 1. i 16.';
    if (cycle === 'WEEKLY') {
        const dan = DANI_U_TJEDNU.find((d) => d.value === Number(weekday));
        return dan ? `Tjedno — ${dan.label.toLowerCase()}` : 'Tjedno — dan nije odabran';
    }
    return 'Mjesečno — 1. u mjesecu';
};

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
    const [editStaff, setEditStaff] = useState(null)
    const [apiUser, setApiUser] = useState({})
    const [rowToActivate, setRowsToActivate] = useState(null);
    

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o partnerima'}))
        await dispatch(getBackofficeThunk({path:'partners'}))
        await dispatch(getBackofficeThunk({path:'countries'}))
        // Djelatnici partnera su obicni operateri s vezom na partnera, pa se
        // citaju iz istog sifarnika kao i nasi ljudi.
        await dispatch(getBackofficeThunk({path:'users'}))
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
        // Web korisnik bez lozinke se ne moze prijaviti. Zatecene takve zapise
        // popunjavamo lozinkom pripadnog djelatnika, po korisnickom imenu.
        const webKorisnici = (newWebUser || []).map((w) => {
            if (w.password) return w
            const djelatnik = djelatniciPartnera.find((d) => d.username === w.username)
            return djelatnik?.password ? { ...w, password: djelatnik.password } : w
        })
        const dataToSend = {
            ...editedData,
            web_permissions: webKorisnici,
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
        // Provizija i dinamika naplate su podloga za obračun, pa se vide iz
        // popisa — bez otvaranja svakog partnera.
        { field: 'commission_pct', headerName: 'Provizija', width: 110, align: 'right', headerAlign: 'right',
            valueGetter: (value) => (value == null ? '' : `${Number(value)} %`) },
        { field: 'billing_cycle', headerName: 'Dinamika naplate', flex: 2,
            valueGetter: (value, row) => opisDinamike(value, row?.billing_weekday) },
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

    // Djelatnici partnera — isti podaci kao kod operatera, jer to i jesu
    // operateri; razlika je samo u tome cija su posada.
    const columns_web = [
        { field: 'name', headerName: 'Ime', flex: 1.5 },
        { field: 'surname', headerName: 'Prezime', flex: 1.5 },
        { field: 'username', headerName: t('backoffice.partners.web_user_username'), flex: 1.5 },
        { field: 'mark', headerName: 'Oznaka', width: 100 },
        { field: 'code', headerName: 'Šifra', width: 100 },
        {
            field: 'web_access',
            headerName: 'Web prodaja',
            width: 130,
            renderCell: (params) => (
                <Checkbox
                    checked={imaWebPristup(params.row.username)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => prebaciWebPristup(params.row)}
                />
            ),
        },
        { field: 'is_active', type: 'boolean', headerName: 'Aktivan', width: 100 },
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

    const handleProcessApiRowUpdate = (newRow) => {
        setNewApiUser((prev) => prev.map((r) => (r.id === newRow.id ? { ...r, ...newRow } : r)));
        return newRow;
    };

    const handleChangeNewWebUser = async(e)=>{
        setWebUser({
            ...webUser, [e.target.name]: e.target.value
        })
    }

    // Djelatnici odabranog partnera. Web pristup se cita iz web_permissions
    // partnera — ista osoba moze raditi na blagajni, a ne imati web prodaju.
    const djelatniciPartnera = (backofficeData.backofficeData.users || [])
        .filter((u) => u.partner_uuid && u.partner_uuid === selectedRow?.uuid)
    const imaWebPristup = (username) => (newWebUser || []).some((w) => w.username === username)

    // Djelatnik partnera se zapisuje kao operater vezan na partnera — isti put
    // kojim se kreiraju i nasi ljudi, pa vrijede ista pravila (jedinstvena
    // oznaka i sifra, hashirana lozinka). Web pristup je zasebna kvacica i
    // sprema se s partnerom, jer partnerska prodaja ima vlastitu prijavu.
    const handleAddWebUser = async ()=>{
        if (!selectedRow?.uuid) return
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Dodavanje djelatnika partnera'}))
        await dispatch(postBackofficeThunk({path:'users', data:{
            name: webUser.name,
            surname: webUser.surname,
            legal_id: webUser.legal_id,
            username: webUser.username,
            password: webUser.password,
            mark: webUser.mark,
            code: webUser.code,
            is_company_employee: false,
            partner_uuid: selectedRow.uuid,
            partner_name: selectedRow.partner_name,
        }}))
        if (webUser.web_access) {
            const newId = newWebUser.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
            setNewWebUser([...newWebUser, {
                id: newId,
                username: webUser.username,
                password: webUser.password,
            }])
        }
        await dispatch(getBackofficeThunk({path:'users'}))
        setWebUser({})
        setAddWebModal(false)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    // Izmjena djelatnika ide istim putem kao izmjena naseg operatera. Lozinka se
    // ne prikazuje: polje je prazno i mijenja je samo tko nesto upise, inace se
    // salje zatecena i jezgra je prepozna kao nepromijenjenu.
    const otvoriDjelatnika = (red) => {
        setEditStaff({ ...red, password: '', _lozinka: red.password })
    }

    const spremiDjelatnika = async () => {
        if (!editStaff?.uuid) return
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Spremanje djelatnika'}))
        await dispatch(patchBackofficeThunk({path:'users', data:{
            uuid: editStaff.uuid,
            name: editStaff.name,
            surname: editStaff.surname,
            legal_id: editStaff.legal_id,
            mark: editStaff.mark,
            code: editStaff.code,
            password: editStaff.password ? editStaff.password : editStaff._lozinka,
            is_active: editStaff.is_active,
            partner_uuid: selectedRow?.uuid,
            partner_name: selectedRow?.partner_name,
        }}))
        await dispatch(getBackofficeThunk({path:'users'}))
        setEditStaff(null)
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    // Web pristup se pali i gasi bez diranja operatera — osoba ostaje na
    // blagajni i kad joj se web prodaja ukine.
    const prebaciWebPristup = (djelatnik) => {
        if (imaWebPristup(djelatnik.username)) {
            setNewWebUser((newWebUser || []).filter((w) => w.username !== djelatnik.username))
            return
        }
        const newId = (newWebUser || []).reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
        // Lozinka se preuzima od djelatnika. Prijava na partnersku prodaju
        // prihvaca i bcrypt zapis, pa osoba ima jednu lozinku i za blagajnu i za
        // web. Prazna lozinka je znacila da se prijava nikad ne moze provjeriti.
        setNewWebUser([...(newWebUser || []), {
            id: newId,
            username: djelatnik.username,
            password: djelatnik.password || '',
        }])
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
                    {/* Dinamika naplate — kada se partneru radi obračun provizije.
                        Po njoj se određuje razdoblje obračuna, pa je dio šifarnika
                        partnera, a ne postavka izvještaja. */}
                    <TextField
                        select
                        variant="outlined"
                        fullWidth
                        label="Dinamika naplate"
                        value={editedData.billing_cycle || "MONTHLY"}
                        onChange={handleChangeEdit}
                        name="billing_cycle"
                        sx={{
                            mt:1
                        }}
                    >
                        <MenuItem value="MONTHLY">Mjesečno — 1. u mjesecu, za prethodni mjesec</MenuItem>
                        <MenuItem value="SEMI_MONTHLY">Dvomjesečno — 1. i 16. u mjesecu</MenuItem>
                        <MenuItem value="WEEKLY">Dan u tjednu</MenuItem>
                    </TextField>
                    {editedData.billing_cycle === "WEEKLY" ? (
                        <TextField
                            select
                            variant="outlined"
                            fullWidth
                            label="Dan obračuna"
                            value={editedData.billing_weekday || ""}
                            onChange={handleChangeEdit}
                            name="billing_weekday"
                            sx={{
                                mt:1
                            }}
                        >
                            {DANI_U_TJEDNU.map((d) => (
                                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                            ))}
                        </TextField>
                    ) : null}
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
                    {/* Vrijedi samo kad partner prodaje za svoj račun (partner-sale,
                        T4B API). Prodaja u naše ime, na partnerskom prodajnom mjestu
                        s našom blagajnom, uvijek ide po prodajnoj cijeni. */}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={editedData.prices_with_vat !== false}
                                onChange={(e) =>
                                    setEditedData({ ...editedData, prices_with_vat: e.target.checked })
                                }
                                name="prices_with_vat"
                            />
                        }
                        label="Cijene s PDV-om (prodaja za vlastiti račun)"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Isključeno: partneru se šalje naša cijena prema njemu — bez PDV-a, s lučkom
                        pristojbom u sebi.
                    </Typography>
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
                            rows={djelatniciPartnera || []}
                            columns={columns_web}
                            getRowId={(row) => row.id}
                            onRowClick={(params) => otvoriDjelatnika(params.row)}
                            sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
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
            {/* Otvara ladicu s obrascem. Prije je bio spojen na `handleSubmit`,
                pa je klik pokušavao spremiti praznog partnera i činilo se da se
                forma ne otvara — obrazac se nikad nije ni prikazao. */}
            <Stack sx={{width:'96%', ml:1}} alignItems='flex-start'>
                <Button onClick={() => setOpenAdd(true)}>
                    {t('backoffice.partners.add_partner')}
                </Button>
            </Stack>
            <Modal
                open={addWebModal} onClose={() => setAddWebModal(false)}
            >
                <Box sx={{ ...style, width: 300, overflowY: "auto" }}>
                    <Typography sx={{ fontWeight: 700 }}>Novi djelatnik partnera</Typography>
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="Ime" value={webUser.name || ""}
                        onChange={handleChangeNewWebUser} name="name" sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="Prezime" value={webUser.surname || ""}
                        onChange={handleChangeNewWebUser} name="surname" sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="OIB" value={webUser.legal_id || ""}
                        onChange={handleChangeNewWebUser} name="legal_id" sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label={t('backoffice.partners.web_user_username')}
                        value={webUser.username || ""}
                        onChange={handleChangeNewWebUser} name="username" sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label={t('backoffice.partners.web_user_password')}
                        value={webUser.password || ""}
                        onChange={handleChangeNewWebUser} name="password" sx={{ mt:1 }}
                    />
                    {/* Oznaka ide na račun i mora biti jedinstvena; šifra je
                        brza prijava na blagajni. Ista pravila kao kod naših
                        operatera — jezgra odbija duplikat. */}
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="Oznaka" placeholder="npr. mn" value={webUser.mark || ""}
                        onChange={handleChangeNewWebUser} name="mark" sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth
                        label="Šifra" placeholder="npr. 1234" value={webUser.code || ""}
                        onChange={handleChangeNewWebUser} name="code" sx={{ mt:1 }}
                    />
                    <FormControlLabel
                        sx={{ mt:1 }}
                        control={
                            <Checkbox
                                checked={!!webUser.web_access}
                                onChange={(e) => setWebUser({ ...webUser, web_access: e.target.checked })}
                                name="web_access"
                            />
                        }
                        label="Ima i pristup partnerskoj web prodaji"
                    />
                    <Button
                        type="submit"
                        onClick={handleAddWebUser}
                        disabled={
                            !webUser.name || !webUser.surname || !webUser.legal_id
                            || !webUser.username || !webUser.password || !webUser.mark
                        }
                        sx={{ height: 60, mt: 4, width: "100%" }}
                        variant="contained"
                        >
                            {t('backoffice.partners.add')}
                    </Button>
                </Box>
            </Modal>
            <Modal
                open={!!editStaff} onClose={() => setEditStaff(null)}
            >
                <Box sx={{ ...style, width: 320, maxHeight: '90vh', overflowY: "auto" }}>
                    <Typography sx={{ fontWeight: 700 }}>Djelatnik partnera</Typography>
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="Ime" value={editStaff?.name || ""}
                        onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })}
                        sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="Prezime" value={editStaff?.surname || ""}
                        onChange={(e) => setEditStaff({ ...editStaff, surname: e.target.value })}
                        sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="OIB" value={editStaff?.legal_id || ""}
                        onChange={(e) => setEditStaff({ ...editStaff, legal_id: e.target.value })}
                        sx={{ mt:1 }}
                    />
                    {/* Korisničko ime se ne mijenja naknadno: po njemu se
                        prepoznaje prijava i veže pristup partnerskoj prodaji. */}
                    <TextField
                        type="text" variant="outlined" fullWidth disabled
                        label={t('backoffice.partners.web_user_username')}
                        value={editStaff?.username || ""}
                        sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth
                        label="Nova lozinka"
                        placeholder="ostavi prazno ako se ne mijenja"
                        value={editStaff?.password || ""}
                        onChange={(e) => setEditStaff({ ...editStaff, password: e.target.value })}
                        sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth required
                        label="Oznaka" value={editStaff?.mark || ""}
                        onChange={(e) => setEditStaff({ ...editStaff, mark: e.target.value })}
                        sx={{ mt:1 }}
                    />
                    <TextField
                        type="text" variant="outlined" fullWidth
                        label="Šifra" value={editStaff?.code || ""}
                        onChange={(e) => setEditStaff({ ...editStaff, code: e.target.value })}
                        sx={{ mt:1 }}
                    />
                    <TextField
                        select variant="outlined" fullWidth
                        label="Aktivan"
                        value={editStaff?.is_active === false ? 'false' : 'true'}
                        onChange={(e) => setEditStaff({ ...editStaff, is_active: e.target.value === 'true' })}
                        sx={{ mt:1 }}
                    >
                        <MenuItem value="true">Da</MenuItem>
                        <MenuItem value="false">Ne (ne može se prijaviti)</MenuItem>
                    </TextField>
                    <Button
                        onClick={spremiDjelatnika}
                        disabled={
                            !editStaff?.name || !editStaff?.surname
                            || !editStaff?.legal_id || !editStaff?.mark
                        }
                        sx={{ height: 60, mt: 3, width: "100%" }}
                        variant="contained"
                    >
                        Spremi
                    </Button>
                    <Button onClick={() => setEditStaff(null)} sx={{ mt: 1, width: "100%" }}>
                        Odustani
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