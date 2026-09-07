import { useRef, useState } from "react";
import { Alert, Box, Button, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import DeleteIcon from "@mui/icons-material/Delete";

// Logo koji se ispisuje u vrhu računa ili karte.
//
// Termalni printer crta jednobojnu sliku fiksne širine — 576 točaka na 80 mm,
// 384 na 58 mm. Slika se zato ovdje pripremi za ispis, ne na uređaju: uređaji
// su tri različite izvedbe (blagajna, Sunmi, PDF) i svaka bi to radila po svome.
//
// Priprema je: skaliranje na najviše MAX_SIRINA točaka i pretvorba u crno-bijelo
// s pragom. Sivi tonovi na termalnoj traci ispadnu kao mrlje, pa je bolje
// odlučiti ovdje nego prepustiti printeru.
const MAX_SIRINA = 576;
const PRAG = 160;

// Iznad ovoga base64 zapis previše optereti sinkronizaciju osnovnih podataka,
// koja ide na svaki uređaj pri svakom pokretanju.
const MAX_BAJTOVA = 120 * 1024;

const pripremiZaTermalni = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Slika se ne može pročitati."));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Datoteka nije slika."));
            img.onload = () => {
                const omjer = Math.min(1, MAX_SIRINA / img.width);
                const w = Math.max(1, Math.round(img.width * omjer));
                const h = Math.max(1, Math.round(img.height * omjer));

                const platno = document.createElement("canvas");
                platno.width = w;
                platno.height = h;
                const ctx = platno.getContext("2d");
                // Bijela podloga: PNG s prozirnošću bi na traci ispao kao crna
                // ploha, jer se prozirno pri pretvorbi čita kao nula.
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);

                const slika = ctx.getImageData(0, 0, w, h);
                const p = slika.data;
                for (let i = 0; i < p.length; i += 4) {
                    const sivo = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
                    const v = sivo < PRAG ? 0 : 255;
                    p[i] = v; p[i + 1] = v; p[i + 2] = v; p[i + 3] = 255;
                }
                ctx.putImageData(slika, 0, 0);
                resolve({ dataUrl: platno.toDataURL("image/png"), w, h });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });

export default function LogoUpload({ label, value, checked, onChange, onToggle }) {
    const inputRef = useRef(null);
    const [greska, setGreska] = useState("");

    const odaberi = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setGreska("");
        try {
            const { dataUrl, w, h } = await pripremiZaTermalni(file);
            if (dataUrl.length > MAX_BAJTOVA) {
                setGreska(`Slika je i nakon pripreme prevelika (${Math.round(dataUrl.length / 1024)} kB). Smanjite je ili pojednostavnite.`);
                return;
            }
            onChange(dataUrl);
            setGreska(`Pripremljeno za ispis: ${w} × ${h} točaka, crno-bijelo.`);
        } catch (err) {
            setGreska(err.message || "Slika se ne može pripremiti.");
        }
    };

    return (
        <Box sx={{ mt: 1, p: 1.5, border: "1px solid rgba(15,23,42,0.12)", borderRadius: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>{label}</Typography>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                {value ? (
                    <Box
                        component="img"
                        src={value}
                        alt={label}
                        sx={{
                            maxWidth: 200, maxHeight: 80, objectFit: "contain",
                            border: "1px solid rgba(15,23,42,0.12)", p: 0.5, bgcolor: "#fff",
                        }}
                    />
                ) : (
                    <Typography variant="caption" color="text.secondary">nema učitane slike</Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => inputRef.current?.click()}>
                    {value ? "Zamijeni" : "Učitaj"}
                </Button>
                {value && (
                    <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => { onChange(null); onToggle(false); setGreska(""); }}
                    >
                        Ukloni
                    </Button>
                )}
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={odaberi} />
            </Stack>
            {/* Prekidač je odvojen od slike: logo se tako privremeno gasi bez
                brisanja učitanog. Bez slike nema što uključiti. */}
            <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Switch size="small" checked={!!checked} disabled={!value} onChange={(e) => onToggle(e.target.checked)} />}
                label={<Typography variant="body2">Ispisuj logo</Typography>}
            />
            {greska && <Alert severity="info" sx={{ mt: 1, py: 0 }}>{greska}</Alert>}
        </Box>
    );
}
