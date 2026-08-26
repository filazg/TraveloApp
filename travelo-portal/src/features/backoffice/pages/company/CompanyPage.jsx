import { useDispatch, useSelector } from "react-redux"
import { backofficeSliceData, getBackofficeThunk, patchBackofficeThunk } from "../../backofficeSlice"
import { useEffect, useState } from "react"
import { Box, Button, Divider, TextField, Typography, useMediaQuery } from "@mui/material"
import { useT } from "../../../../i18n/useT"
import { setAuthData } from "../../../auth/authSlice"
import { provjeriIban } from "../../../../helpers/iban"


export default function CompanyPage (){
    const dispatch = useDispatch()
    const backofficeData = useSelector(backofficeSliceData)
    const isNonMobile = useMediaQuery("(min-width:600px)");
    const { t } = useT();

    const [form, setForm] = useState({})

    useEffect(() => {
        const c = backofficeData.backofficeData.company || {}
        setForm({
            id: c.id,
            uuid: c.uuid,
            name: c.name || "",
            additional_name: c.additional_name || "",
            address: c.address || "",
            postal_code: c.postal_code || "",
            town: c.town || "",
            acr: c.acr || "",
            legal_id: c.legal_id || "",
            contact_tel: c.contact_tel || "",
            contact_email: c.contact_email || "",
            contact_person: c.contact_person || "",
            iban: c.iban || "",
            swift: c.swift || "",
            bank_name: c.bank_name || "",
            saop_organization_id: c.saop_organization_id || "",
            saop_link_to_book: c.saop_link_to_book || "",
            saop_default_customer: c.saop_default_customer || "",
        })
    }, [backofficeData.backofficeData.company])

    const handleChange = (e) => {
        const { name, value } = e.target
        setForm((s) => ({ ...s, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        await dispatch(setAuthData({ path: 'loading', value: true }))
        await dispatch(setAuthData({ path: 'loadingMessage', value: 'Ažuriranje podataka o tvrtki' }))
        await dispatch(patchBackofficeThunk({ path: 'company', data: form }))
        await dispatch(setAuthData({ path: 'loading', value: false }))
    }

    const syncData = async () =>{
        await dispatch(setAuthData({path:'loading', value:true}))
        await dispatch(setAuthData({path:'loadingMessage', value:'Preuzimanje podataka o tvrtci'}))
        await dispatch(getBackofficeThunk({path:'company'}))
        await dispatch(setAuthData({path:'loading', value:false}))
    }

    useEffect(()=>{
        syncData()
    },[])

    return(
        <Box sx={{ mt:2, ml:2 }}>
                <Box direction="row" justifyContent="center" sx={{ width: 1 }}>
                    <form onSubmit={handleSubmit}>
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
                                value={form.name || ""}
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
                                value={form.additional_name || ""}
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
                                value={form.address || ""}
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
                                value={form.postal_code || ""}
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
                                value={form.town || ""}
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
                                value={form.acr || ""}
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
                                value={form.id || ""}
                                name="id"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.vatid')}
                                placeholder={t('backoffice.company.vatid')}
                                value={form.legal_id || ""}
                                onChange={handleChange}
                                name="legal_id"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label={t('backoffice.company.contact_tel')}
                                placeholder={t('backoffice.company.contact_tel')}
                                value={form.contact_tel || ""}
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
                                value={form.contact_email || ""}
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
                                value={form.contact_person || ""}
                                onChange={handleChange}
                                name="contact_person"
                                sx={{ gridColumn: "span 2" }}
                            />
                        </Box>

                        <Divider sx={{ mt: 4, mb: 2 }} />
                        <Typography variant="h6" sx={{ mb: 0.5 }}>
                            Bankovni podaci
                        </Typography>
                        {/* IBAN tvrtke je u SEPA nalogu račun platitelja — bez njega
                            se datoteka za e-bankarstvo ne može složiti. */}
                        <Typography variant="caption" color="text.secondary">
                            IBAN je platitelj u SEPA nalozima za povrat
                        </Typography>
                        <Box
                           display="grid"
                           gap="30px"
                           gridTemplateColumns="repeat(8, minmax(0, 1fr))"
                           sx={{
                               mt: 2,
                               width: 'auto',
                               "& > div": { gridColumn: isNonMobile ? undefined : "span 8" },
                           }}
                        >
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label="IBAN"
                                placeholder="HR12 1001 0051 8630 0016 0"
                                value={form.iban || ""}
                                onChange={handleChange}
                                name="iban"
                                error={!!form.iban && !provjeriIban(form.iban).ok}
                                helperText={
                                    !form.iban
                                        ? "Račun s kojeg odlaze povrati"
                                        : provjeriIban(form.iban).ok
                                        ? "IBAN je ispravan"
                                        : provjeriIban(form.iban).razlog
                                }
                                sx={{ gridColumn: "span 3" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label="SWIFT / BIC"
                                placeholder="npr. ZABAHR2X"
                                value={form.swift || ""}
                                onChange={handleChange}
                                name="swift"
                                helperText="nije obavezan"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label="Banka"
                                placeholder="npr. Zagrebačka banka d.d."
                                value={form.bank_name || ""}
                                onChange={handleChange}
                                name="bank_name"
                                sx={{ gridColumn: "span 3" }}
                            />
                        </Box>

                        <Divider sx={{ mt: 4, mb: 2 }} />
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            SAOP iCenter (ERP) postavke
                        </Typography>
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
                                label="SAOP Organisation ID"
                                placeholder="npr. 2"
                                value={form.saop_organization_id || ""}
                                onChange={handleChange}
                                name="saop_organization_id"
                                sx={{ gridColumn: "span 2" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label="Link to Book"
                                placeholder="npr. T4B TRANSPORT"
                                value={form.saop_link_to_book || ""}
                                onChange={handleChange}
                                name="saop_link_to_book"
                                sx={{ gridColumn: "span 3" }}
                            />
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label="Default Customer (krajnji kupac)"
                                placeholder="npr. 0000556"
                                value={form.saop_default_customer || ""}
                                onChange={handleChange}
                                name="saop_default_customer"
                                sx={{ gridColumn: "span 3" }}
                            />
                        </Box>

                        <Button
                            type="submit"
                            sx={{mt:3, height: 60, width: "100%" }}
                            variant="contained"
                        >
                            {t('backoffice.company.confirm_button')}
                        </Button>
                    </form>
                </Box>
        </Box>
    )
}
