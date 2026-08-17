import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
    Alert,
    Box,
    Button,
    Divider,
    FormControlLabel,
    MenuItem,
    Paper,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { backofficeSliceData, getBackofficeThunk } from "../../backofficeSlice";
import { authSliceData, setAuthData } from "../../../auth/authSlice";

// Zajednička kartica za postavke izdavanja računa jednog prodajnog kanala.
// Kanali se razlikuju samo tekstom, ne poljima — web prodaja i partnerski
// računi izdaju se po istim parametrima (prostor, uređaj, plaćanje, fiskalizacija).
// Provizija i dinamika izdavanja NISU ovdje: to ostaje po partneru.
export default function ChannelSettingsPage({ channel, title, subtitle, hint, showLanguage = true }) {
    const dispatch = useDispatch();
    const backofficeData = useSelector(backofficeSliceData);
    const authData = useSelector(authSliceData);

    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    const api = useMemo(() => axios.create({
        baseURL: authData.backendURL,
        withCredentials: true,
    }), [authData.backendURL]);

    // Gateway odmata jedan sloj odgovora, pa polje može doći i top-level i pod .data.
    const unwrap = (resp, key) => resp?.data?.[key] ?? resp?.data?.data?.[key] ?? null;

    const premises = backofficeData.backofficeData.business_premises || [];
    const devices = backofficeData.backofficeData.billing_devices || [];
    const paymentMethods = backofficeData.backofficeData.payment_methods || [];

    // Uređaji se nude samo s odabranog prodajnog mjesta — inače je lako
    // spojiti uređaj koji fizički pripada drugom prostoru.
    const devicesForPremise = devices.filter(
        (d) => !form?.business_premise_uuid || d.business_premise_uuid === form.business_premise_uuid
    );

    const load = async () => {
        setError("");
        try {
            const r = await api.get(`/portal/backoffice/channel_settings/${channel}`);
            setForm(unwrap(r, "channel_settings") || {});
        } catch (e) {
            setError(e?.response?.data?.error || e.message || "Dohvat postavki nije uspio.");
            setForm({});
        }
    };

    useEffect(() => {
        const init = async () => {
            dispatch(setAuthData({ path: "loadingMessage", value: "Dohvat postavki" }));
            dispatch(setAuthData({ path: "loading", value: true }));
            await Promise.all([
                dispatch(getBackofficeThunk({ path: "business_premises" })),
                dispatch(getBackofficeThunk({ path: "billing_devices" })),
                dispatch(getBackofficeThunk({ path: "payment_methods" })),
            ]);
            await load();
            dispatch(setAuthData({ path: "loading", value: false }));
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, channel]);

    const set = (patch) => {
        setSaved(false);
        setForm((prev) => ({ ...(prev || {}), ...patch }));
    };

    const handlePremise = (uuid) => {
        const bp = premises.find((p) => p.uuid === uuid);
        // Promjena prostora poništava uređaj — stari više ne pripada ovdje.
        set({
            business_premise_uuid: uuid,
            business_premise_name: bp?.name || null,
            business_premise_fiscal_mark: bp?.fiskal_mark || null,
            billing_device_uuid: "",
            billing_device_fiscal_mark: null,
        });
    };

    const handleDevice = (uuid) => {
        const bd = devices.find((d) => d.uuid === uuid);
        set({
            billing_device_uuid: uuid,
            billing_device_fiscal_mark: bd?.fiscal_mark || null,
            // Mjesto troška se vodi na uređaju; preuzmi ga ako ovdje nije upisano.
            cost_center: form?.cost_center || bd?.cost_center || null,
        });
    };

    const handlePaymentMethod = (uuid) => {
        const pm = paymentMethods.find((p) => p.uuid === uuid);
        set({ payment_method_uuid: uuid, payment_method_name: pm?.name || null });
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const r = await api.patch(`/portal/backoffice/channel_settings/${channel}`, form);
            setForm(unwrap(r, "channel_settings") || form);
            setSaved(true);
        } catch (e) {
            setError(e?.response?.data?.error || e.message || "Spremanje nije uspjelo.");
        } finally {
            setSaving(false);
        }
    };

    if (!form) return null;

    const incomplete = !form.business_premise_uuid || !form.billing_device_uuid;

    return (
        <Box sx={{ width: "100%", maxWidth: 900, p: 2 }}>
            <Typography variant="h5" fontWeight={700}>{title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>

            {hint && <Alert severity="info" sx={{ mb: 2 }}>{hint}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {saved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>Postavke su spremljene.</Alert>}
            {form.is_active && incomplete && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Kanal je uključen, ali nije odabrano prodajno mjesto i naplatni uređaj — računi se neće moći izdati.
                </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={form.is_active !== false}
                            onChange={(e) => set({ is_active: e.target.checked })}
                        />
                    }
                    label="Kanal je u upotrebi"
                />

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Fiskalne oznake</Typography>
                <Stack spacing={2}>
                    <TextField
                        select
                        fullWidth
                        label="Prodajno mjesto"
                        value={form.business_premise_uuid || ""}
                        onChange={(e) => handlePremise(e.target.value)}
                        helperText="Njegova fiskalna oznaka ide na račun"
                    >
                        {premises.map((bp) => (
                            <MenuItem key={bp.uuid} value={bp.uuid}>
                                {bp.name} · {bp.fiskal_mark || "bez oznake"} ({bp.type})
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        fullWidth
                        label="Naplatni uređaj"
                        value={form.billing_device_uuid || ""}
                        onChange={(e) => handleDevice(e.target.value)}
                        disabled={!form.business_premise_uuid}
                        helperText={
                            !form.business_premise_uuid
                                ? "Prvo odaberi prodajno mjesto"
                                : devicesForPremise.length === 0
                                    ? "Na odabranom prodajnom mjestu nema naplatnih uređaja"
                                    : "Iz njegove oznake se formira broj računa"
                        }
                    >
                        {devicesForPremise.map((bd) => (
                            <MenuItem key={bd.uuid} value={bd.uuid}>
                                {bd.name} · {bd.fiscal_mark || "bez oznake"}
                            </MenuItem>
                        ))}
                    </TextField>
                </Stack>

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Naplata</Typography>
                <Stack spacing={2}>
                    <TextField
                        select
                        fullWidth
                        label="Sredstvo plaćanja"
                        value={form.payment_method_uuid || ""}
                        onChange={(e) => handlePaymentMethod(e.target.value)}
                    >
                        {paymentMethods.map((pm) => (
                            <MenuItem key={pm.uuid} value={pm.uuid}>{pm.name}</MenuItem>
                        ))}
                    </TextField>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={form.fiskal_required === true}
                                onChange={(e) => set({ fiskal_required: e.target.checked })}
                            />
                        }
                        label="Fiskalizacija računa (F2 / YesCor)"
                    />

                    <TextField
                        fullWidth
                        label="Mjesto troška"
                        value={form.cost_center || ""}
                        onChange={(e) => set({ cost_center: e.target.value })}
                        helperText="Ide u zaključak prometa i temeljnicu; prazno = preuzima se s naplatnog uređaja"
                    />
                </Stack>

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Izgled računa</Typography>
                <Stack spacing={2}>
                    {showLanguage && (
                        <TextField
                            select
                            fullWidth
                            label="Jezik računa"
                            value={form.invoice_language || "hr"}
                            onChange={(e) => set({ invoice_language: e.target.value })}
                        >
                            <MenuItem value="hr">Hrvatski</MenuItem>
                            <MenuItem value="en">Engleski</MenuItem>
                        </TextField>
                    )}

                    <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Zaglavlje računa"
                        value={form.invoice_header || ""}
                        onChange={(e) => set({ invoice_header: e.target.value })}
                    />

                    <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Podnožje računa"
                        value={form.invoice_footer || ""}
                        onChange={(e) => set({ invoice_footer: e.target.value })}
                    />
                </Stack>

                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Spremam…" : "Spremi postavke"}
                    </Button>
                </Stack>
            </Paper>
        </Box>
    );
}
