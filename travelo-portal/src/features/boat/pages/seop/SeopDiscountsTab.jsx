import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Alert, Box, Button, Chip, CircularProgress, Divider, FormControlLabel,
    Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { resolveBackendUrl } from "../../../../helpers/backendUrl";

const backendURL = resolveBackendUrl("/app");
const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrap = (r) => r?.data?.data?.data ?? r?.data?.data ?? r?.data ?? {};

// Popusti po pravu na povlašteni prijevoz.
//
// Zašto uopće postoji: online SEOP uz pravo vrati i postotak, pa se ovdje
// upisano ne koristi. Bez mreže čip daje samo šifru prava — postotka nema
// odakle, pa ga blagajna i mobilna uzimaju odavde.
//
// Popust vrijedi samo na linijama na kojima je uključena primjena SEOP popusta
// (Brod → Linije). Ondje gdje otočna cijena iz cjenika već jest konačna, ovo se
// ne primjenjuje ni s mrežom ni bez nje.
//
// Prazan postotak znači „bez popusta" i takav se redak ne sprema — popust koji
// nitko nije odredio ne smije se izmisliti.
const RAZRED = {
    popust: { label: "popust", color: "info" },
    besplatno: { label: "besplatno", color: "success" },
    kombinirano: { label: "kombinirano", color: "warning" },
};

export default function SeopDiscountsTab() {
    const [prava, setPrava] = useState(null);
    const [ucitavanje, setUcitavanje] = useState(true);
    const [spremanje, setSpremanje] = useState(false);
    const [poruka, setPoruka] = useState(null);
    // Prava bez upisanog popusta su većina popisa, a ured obično dira samo
    // nekoliko njih — prekidač ih skloni da se izmijenjeni redci vide odjednom.
    const [samoSPopustom, setSamoSPopustom] = useState(false);

    const ucitaj = async () => {
        setUcitavanje(true);
        try {
            const p = unwrap(await api.get("/portal/boat/seop_right_discounts"));
            setPrava(p.rights || []);
        } catch (e) {
            setPoruka({ severity: "error", text: e.response?.data?.data?.message || e.message });
            setPrava(null);
        } finally {
            setUcitavanje(false);
        }
    };

    useEffect(() => { ucitaj(); /* eslint-disable-next-line */ }, []);

    const postavi = (code, polje, vrijednost) => {
        setPrava((arr) => arr.map((p) => (p.code === code ? { ...p, [polje]: vrijednost } : p)));
    };

    // Postotak se upisuje kao tekst da se polje smije isprazniti; prazno je 0.
    const postaviPostotak = (code, tekst) => {
        const ocisceno = tekst.replace(/[^\d]/g, "").slice(0, 3);
        const broj = ocisceno === "" ? 0 : Math.min(100, parseInt(ocisceno, 10));
        postavi(code, "discount_pct", broj);
    };

    const sPopustom = useMemo(
        () => (prava || []).filter((p) => Number(p.discount_pct) > 0),
        [prava]
    );

    // Sprema se i pravo bez postotka ako mu je upisan naziv: online SEOP
    // postotak daje sam, ali naziv na karti treba i tada. Redak bez ijednog od
    // to dvoje nema sto zapisati.
    const zaSpremanje = useMemo(
        () => (prava || []).filter((p) => Number(p.discount_pct) > 0 || String(p.ticket_label || "").trim()),
        [prava]
    );

    const spremi = async () => {
        setSpremanje(true);
        setPoruka(null);
        try {
            // Šalju se samo prava s postotkom. Redak vraćen na 0 nestaje, čime
            // se popust stvarno povlači s uređaja, a ne ostaje tiho vrijediti.
            const discounts = zaSpremanje.map((p) => ({
                code: p.code,
                ticket_label: String(p.ticket_label || "").trim() || null,
                discount_pct: Number(p.discount_pct) || 0,
                is_active: p.is_active !== false,
            }));
            await api.post("/portal/boat/seop_right_discounts", { discounts });
            setPoruka({
                severity: "success",
                text: discounts.length
                    ? `Spremljeno ${discounts.length} prava.`
                    : "Spremljeno — nijedno pravo nema popust, uređaji bez mreže neće primjenjivati popust.",
            });
            ucitaj();
        } catch (e) {
            setPoruka({ severity: "error", text: e.response?.data?.data?.message || e.message });
        } finally {
            setSpremanje(false);
        }
    };

    if (ucitavanje) {
        return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
    }
    if (!prava) {
        return (
            <Alert severity="error">
                Katalog prava se nije učitao. Katalog drži servis za AKD — provjerite radi li.
            </Alert>
        );
    }

    const prikazani = samoSPopustom ? sPopustom : prava;

    return (
        <Stack spacing={2}>
            {poruka && <Alert severity={poruka.severity} onClose={() => setPoruka(null)}>{poruka.text}</Alert>}

            <Typography variant="body2" color="text.secondary">
                Postotak se primjenjuje samo kad se pravo utvrdi s čipa, a SEOP se ne može pitati
                (blagajna ili mobilna bez mreže), i to isključivo na linijama na kojima je uključena
                primjena SEOP popusta. Dok je mreža dostupna, postotak dolazi sa SEOP-a i ovdje
                upisano se ne koristi.
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                    size="small"
                    color={sPopustom.length ? "success" : "default"}
                    variant={sPopustom.length ? "filled" : "outlined"}
                    label={`${sPopustom.length} prava s popustom`}
                    sx={{ fontWeight: 700 }}
                />
                <Box sx={{ flex: 1 }} />
                <FormControlLabel
                    control={<Switch checked={samoSPopustom} onChange={(e) => setSamoSPopustom(e.target.checked)} />}
                    label="Prikaži samo prava s popustom"
                />
            </Stack>

            <Divider />

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>Šifra</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Pravo</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>Naziv na karti</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>Razred</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>Prebivalište</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }} align="right">Popust %</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }} align="center">Aktivno</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {prikazani.map((p) => {
                            const razred = RAZRED[p.razred] || null;
                            const imaPopust = Number(p.discount_pct) > 0;
                            return (
                                <TableRow key={p.code} hover>
                                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                                        {p.code}
                                        {p.izvan_kataloga && (
                                            <Chip size="small" color="warning" variant="outlined"
                                                label="izvan kataloga" sx={{ ml: 1 }} />
                                        )}
                                    </TableCell>
                                    <TableCell>{p.opis || "—"}</TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            value={p.ticket_label || ""}
                                            placeholder="npr. Otočani – umirovljenici"
                                            onChange={(e) => postavi(p.code, "ticket_label", e.target.value.slice(0, 60))}
                                            sx={{ width: 240 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {razred
                                            ? <Chip size="small" color={razred.color} label={razred.label} />
                                            : "—"}
                                    </TableCell>
                                    <TableCell>
                                        {p.rezident
                                            ? <Chip size="small" variant="outlined" label="da" />
                                            : <Typography variant="body2" color="text.secondary">ne</Typography>}
                                    </TableCell>
                                    <TableCell align="right">
                                        <TextField
                                            size="small"
                                            value={p.discount_pct ? String(p.discount_pct) : ""}
                                            placeholder="0"
                                            onChange={(e) => postaviPostotak(p.code, e.target.value)}
                                            inputProps={{ inputMode: "numeric", style: { textAlign: "right" } }}
                                            sx={{ width: 90 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch
                                            checked={p.is_active !== false}
                                            disabled={!imaPopust}
                                            onChange={(e) => postavi(p.code, "is_active", e.target.checked)}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!prikazani.length && (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                        Nijedno pravo nema upisan popust.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Box>

            <Divider />

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={spremi} disabled={spremanje}>
                    {spremanje ? "Spremanje…" : "SPREMI"}
                </Button>
            </Box>
        </Stack>
    );
}
