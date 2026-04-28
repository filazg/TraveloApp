import { useDispatch, useSelector } from "react-redux"
import { backofficeSliceData, getBackofficeThunk } from "../../backofficeSlice"
import { useEffect } from "react"
import { Box, Button, TextField, useMediaQuery } from "@mui/material"
import { useT } from "../../../../i18n/useT"
import { setAuthData } from "../../../auth/authSlice"


export default function CompanyPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const isNonMobile = useMediaQuery("(min-width:600px)");
    const { t } = useT();

    const handleChange = (e)=>{ 
    }

    const handleSubmit = async (e)=>{
        e.preventDefault();
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Ažuriranje podataka o tvrtki'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    const syncData = async () =>{
        console.log('tu smo comapyn sync')
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o tvrtci'}))
        await dispatch(getBackofficeThunk({path:'company'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }
    
    useEffect(()=>{
        syncData()
    },[])

    return(
        <Box sx={{
            mt:2,
            ml:2,
        }}>
                <Box
                    direction="row"
                    justifyContent="center"
                    sx={{ width: 1 }}
                >
                    <form>
                        <Box
                           display="grid"
                           gap="30px"
                           gridTemplateColumns="repeat(8, minmax(0, 1fr))"
                           sx={{
                               width: 'auto',
                               "& > div": { gridColumn: isNonMobile ? undefined : "span 8" },
                           }}
                        >
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.name')}
                                placeholder={t('backoffice.company.name')}
                                required
                                value={backofficeData.backofficeData.company?.name || ""}
                                onChange={handleChange}
                                name="name"
                                sx={{ gridColumn: "span 3" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.additional_name')}
                                placeholder={t('backoffice.company.additional_name')}
                                value={backofficeData.backofficeData.company?.additional_name || ""}
                                onChange={handleChange}
                                name="additional_name"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.address')}
                                placeholder={t('backoffice.company.address')}
                                required
                                value={backofficeData.backofficeData.company?.address || ""}
                                onChange={handleChange}
                                name="address"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.postal_code')}
                                placeholder={t('backoffice.company.postal_code')}
                                required
                                value={backofficeData.backofficeData.company?.postal_code || ""}
                                onChange={handleChange}
                                name="postal_code"
                                sx={{ gridColumn: "span 1" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.town')}
                                placeholder={t('backoffice.company.town')}
                                required
                                value={backofficeData.backofficeData.company?.town || ""}
                                onChange={handleChange}
                                name="town"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                disabled
                                label={t('backoffice.company.acr')}
                                placeholder={t('backoffice.company.acr')}
                                required
                                value={backofficeData.backofficeData.company?.acr || ""}
                                name="acr"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                disabled
                                label={t('backoffice.company.id')}
                                placeholder={t('backoffice.company.id')}
                                required
                                value={backofficeData.backofficeData.company?.id || ""}
                                name="id"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.vatid')}
                                placeholder={t('backoffice.company.vatid')}
                                value={backofficeData.backofficeData.company?.legal_id || ""}
                                name="vatid"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.contact_tel')}
                                placeholder={t('backoffice.company.contact_tel')}
                                value={backofficeData.backofficeData.company?.contact_tel || ""}
                                onChange={handleChange}
                                name="contact_tel"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.contact_email')}
                                placeholder={t('backoffice.company.contact_email')}
                                value={backofficeData.backofficeData.company?.contact_email || ""}
                                onChange={handleChange}
                                name="contact_email"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.contact_person')}
                                placeholder={t('backoffice.company.contact_person')}
                                value={backofficeData.backofficeData.company?.contact_person || ""}
                                onChange={handleChange}
                                name="contact_person"
                                sx={{ gridColumn: "span 2" }}
                            />
                        </Box>
                            <Button
                                type="submit"
                                onClick={handleSubmit}
                                //disabled={!canSubmit}
                                sx={{mt:2, height: 60, width: "100%", gridColumn: "span 2" }}
                                variant="contained"
                            >
                                {t('backoffice.company.confirm_button')}
                            </Button>
                    </form>
                </Box>
        </Box>
    )
}