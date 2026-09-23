import { useCallback, useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, CircularProgress, IconButton, TextField, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import axios from "axios";
import { resolveBackendUrl } from "./backendUrl";

// Izbor šifre iz SAOP-a (mjesto troška, nositelj troška, referent).
//
// Dosad se broj upisivao rukom, pa se u knjiženju pojavila šifra koja u
// iCenteru ne postoji (`0000027`) i temeljnica je pala tek na njihovoj strani.
// Ovdje se bira iz njihovog popisa, s imenom uz šifru — „Linija Split - Hvar -
// Split", ne „16".
//
// Popisi se ne prepisuju u našu bazu: mali su i stižu za pola sekunde, pa se
// čitaju živi (servis ih kratko drži u memoriji). Gumb pokraj polja tjera
// svježe čitanje, za slučaj da je knjigovodstvo upravo otvorilo novu šifru.
const api = axios.create({ baseURL: resolveBackendUrl("/app"), withCredentials: true });

const NASLOVI = {
    cost_centers: "Mjesto troška (SAOP)",
    cost_units: "Nositelj troška (SAOP)",
    clerks: "Referent (SAOP)",
};

// Šifre su sedmeroznamenkaste s vodećim nulama; zatečene vrijednosti u našim
// šifarnicima su bez njih ("16"), pa se uspoređuje po broju, ne po tekstu.
const istaSifra = (a, b) => {
    const broj = (v) => String(v ?? "").trim().replace(/^0+/, "");
    return broj(a) !== "" && broj(a) === broj(b);
};

export default function SaopSifraPicker({ kind, value, onChange, label, disabled, sx }) {
    const [stavke, setStavke] = useState([]);
    const [ucitava, setUcitava] = useState(false);
    const [greska, setGreska] = useState(null);

    const dohvati = useCallback(async (svjeze = false) => {
        setUcitava(true);
        setGreska(null);
        try {
            const r = await api.get("/portal/backoffice/seyfor_codebook", {
                params: { kind, ...(svjeze ? { refresh: 1 } : {}) },
            });
            const podaci = r.data?.data?.data ?? r.data?.data ?? r.data;
            setStavke(podaci?.items || []);
        } catch (e) {
            setGreska(e?.response?.data?.data?.message || e.message || "Šifarnik nije dostupan");
            setStavke([]);
        } finally {
            setUcitava(false);
        }
    }, [kind]);

    useEffect(() => { dohvati(false); }, [dohvati]);

    // Zatečena vrijednost možda nije u popisu (stara ili pogrešna šifra). Tada
    // se i dalje prikazuje, uz napomenu — da se vidi što je upisano, umjesto da
    // polje ispadne prazno i izmjena tiho obriše postojeće.
    const odabrano = useMemo(() => {
        if (!value) return null;
        const nadeno = stavke.find((s) => istaSifra(s.code, value));
        return nadeno || { code: String(value), name: "— nije u SAOP šifarniku —", is_active: false };
    }, [value, stavke]);

    return (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, ...sx }}>
            <Autocomplete
                fullWidth
                size="small"
                disabled={disabled}
                options={stavke}
                value={odabrano}
                loading={ucitava}
                isOptionEqualToValue={(o, v) => istaSifra(o?.code, v?.code)}
                getOptionLabel={(o) => (o?.code ? `${o.code} — ${o.name}` : "")}
                onChange={(_e, novo) => onChange(novo?.code || "")}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label || NASLOVI[kind] || "SAOP šifra"}
                        error={!!greska || (!!value && odabrano && !odabrano.is_active)}
                        helperText={
                            greska
                                ? `SAOP: ${greska}`
                                : value && odabrano && !odabrano.is_active
                                    ? "Ova šifra ne postoji ili nije aktivna u SAOP-u — knjiženje bi palo."
                                    : " "
                        }
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {ucitava ? <CircularProgress size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                    />
                )}
            />
            <Tooltip title="Osvježi šifarnik iz SAOP-a">
                <span>
                    <IconButton size="small" onClick={() => dohvati(true)} disabled={disabled || ucitava} sx={{ mt: 0.5 }}>
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    );
}
