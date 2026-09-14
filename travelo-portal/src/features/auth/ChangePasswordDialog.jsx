import { useState } from "react";
import axios from "axios";
import {
    Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, InputAdornment, Stack, TextField,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useSelector } from "react-redux";
import { authSliceData } from "./authSlice";

// Promjena vlastite lozinke. Korisnika backend uzima iz sesijskog kolacica, pa
// ovdje saljemo samo staru i novu lozinku — nikad username.
export default function ChangePasswordDialog({ open, onClose }) {
    const authData = useSelector(authSliceData);
    const [stara, setStara] = useState("");
    const [nova, setNova] = useState("");
    const [potvrda, setPotvrda] = useState("");
    const [prikazi, setPrikazi] = useState(false);
    const [greska, setGreska] = useState("");
    const [uspjeh, setUspjeh] = useState(false);
    const [salje, setSalje] = useState(false);

    const zatvori = () => {
        if (salje) return;
        setStara(""); setNova(""); setPotvrda("");
        setGreska(""); setUspjeh(false); setPrikazi(false);
        onClose();
    };

    const posalji = async () => {
        setGreska("");
        if (!stara || !nova) { setGreska("Unesite trenutnu i novu lozinku."); return; }
        if (nova !== potvrda) { setGreska("Nova lozinka i potvrda se ne podudaraju."); return; }
        setSalje(true);
        try {
            const api = axios.create({ baseURL: authData.backendURL, withCredentials: true });
            const resp = await api.post("/auth/login/changePassword", { oldPassword: stara, newPassword: nova });
            if (resp.status === 200) {
                setUspjeh(true);
                setStara(""); setNova(""); setPotvrda("");
            } else {
                setGreska(resp.data?.message || "Promjena lozinke nije uspjela.");
            }
        } catch (err) {
            setGreska(err.response?.data?.message || "Promjena lozinke nije uspjela.");
        } finally {
            setSalje(false);
        }
    };

    return (
        <Dialog open={open} onClose={zatvori} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>Promjena lozinke</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 0.5 }}>
                    {uspjeh ? (
                        <Alert severity="success">Lozinka je uspješno promijenjena.</Alert>
                    ) : (
                        <>
                            {greska ? <Alert severity="error">{greska}</Alert> : null}
                            <TextField
                                label="Trenutna lozinka"
                                type={prikazi ? "text" : "password"}
                                value={stara}
                                onChange={(e) => setStara(e.target.value)}
                                autoComplete="current-password"
                                fullWidth
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton edge="end" onClick={() => setPrikazi((s) => !s)}>
                                                {prikazi ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <TextField
                                label="Nova lozinka"
                                type={prikazi ? "text" : "password"}
                                value={nova}
                                onChange={(e) => setNova(e.target.value)}
                                autoComplete="new-password"
                                fullWidth
                            />
                            <TextField
                                label="Potvrdi novu lozinku"
                                type={prikazi ? "text" : "password"}
                                value={potvrda}
                                onChange={(e) => setPotvrda(e.target.value)}
                                autoComplete="new-password"
                                fullWidth
                                onKeyDown={(e) => { if (e.key === "Enter") posalji(); }}
                            />
                        </>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={zatvori} disabled={salje}>{uspjeh ? "Zatvori" : "Odustani"}</Button>
                {!uspjeh ? (
                    <Button variant="contained" onClick={posalji} disabled={salje} sx={{ fontWeight: 700 }}>
                        {salje ? "Spremam…" : "Spremi"}
                    </Button>
                ) : null}
            </DialogActions>
        </Dialog>
    );
}
