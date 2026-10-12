import { useState } from "react";
import { Box, Button, InputAdornment, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

// Cijene nove vrste karte preuzete iz vrste koja je već unesena na isti
// plovidbeni red, uz popust. Npr. kućni ljubimci = Redovna − 50 %.
//
// Preuzimanje samo popuni tablicu u prozoru — cijena se i dalje može ručno
// ispraviti po relaciji prije spremanja, a sprema se kao i ručno unesena.
// Veza s izvornom kategorijom se ne pamti: kasnija izmjena Redovne ne mijenja
// ovu kategoriju.

// Relacija se traži po šiframa luka. Kad je uključeno "oba smjera", prikazana
// je samo jedna strana para, pa se gleda i obrnuti smjer.
const kljuc = (from, to) => `${from}|${to}`;

export const preuzmiCijene = (redovi, izvor, popustPct, calcRow) => {
    const faktor = 1 - (Number(popustPct) || 0) / 100;
    const poRelaciji = new Map();
    for (const r of izvor || []) poRelaciji.set(kljuc(r.harbor_from_code, r.harbor_to_code), r);
    let nadeno = 0;
    const novi = (redovi || []).map((r) => {
        const src = poRelaciji.get(kljuc(r.harbor_from_code, r.harbor_to_code))
            || poRelaciji.get(kljuc(r.harbor_to_code, r.harbor_from_code));
        if (!src) return r;
        nadeno += 1;
        const cijena = Math.round(Number(src.price || 0) * faktor * 100) / 100;
        return calcRow({ ...r, price: cijena });
    });
    return { redovi: novi, nadeno };
};

export default function CopyPricesFromCategory({ kategorije, odabranaUuid, onPrimijeni }) {
    const [izvorUuid, setIzvorUuid] = useState("");
    const [popust, setPopust] = useState("0");
    const [poruka, setPoruka] = useState("");

    // Ponudi se samo ono što ima cijene, i ne ista vrsta koja se upravo unosi.
    const ponuda = (kategorije || []).filter(
        (k) => k?.ticket_type?.uuid && k.ticket_type.uuid !== odabranaUuid && (k.prices || []).length,
    );
    if (!ponuda.length) return null;

    const pct = Number(String(popust).replace(",", "."));
    const pctValjan = Number.isFinite(pct) && pct >= 0 && pct <= 100;

    const primijeni = () => {
        const izvor = ponuda.find((k) => k.ticket_type.uuid === izvorUuid);
        if (!izvor || !pctValjan) return;
        const nadeno = onPrimijeni(izvor.prices, pct);
        setPoruka(`Preuzeto iz „${izvor.ticket_type.name}"${pct ? ` uz popust ${pct} %` : ""} — ${nadeno} relacija. Cijene možete još ručno ispraviti.`);
    };

    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, ml: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Cijene kao kod druge vrste karte
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                    select
                    size="small"
                    label="Preuzmi cijene iz"
                    value={izvorUuid}
                    onChange={(e) => { setIzvorUuid(e.target.value); setPoruka(""); }}
                    sx={{ width: 260 }}
                >
                    {ponuda.map((k) => (
                        <MenuItem key={k.ticket_type.uuid} value={k.ticket_type.uuid}>{k.ticket_type.name}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    label="Popust"
                    value={popust}
                    onChange={(e) => { setPopust(e.target.value); setPoruka(""); }}
                    error={!pctValjan}
                    helperText={!pctValjan ? "0 – 100" : undefined}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    sx={{ width: 130 }}
                />
                <Button variant="outlined" onClick={primijeni} disabled={!izvorUuid || !pctValjan}>
                    Primijeni
                </Button>
            </Stack>
            {poruka && (
                <Box sx={{ mt: 1.5 }}>
                    <Typography variant="body2" color="success.main">{poruka}</Typography>
                </Box>
            )}
        </Paper>
    );
}
