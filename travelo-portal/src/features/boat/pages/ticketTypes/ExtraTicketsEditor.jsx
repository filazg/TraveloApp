import { Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";

// Dodatne karte uz vrstu karte (npr. Redovna → dojenče).
//
// Pri prodaji se uz kartu ove vrste mogu dodati karte vezanih vrsta, bez
// naplate, najviše „max po karti" za svaku kartu roditelja. Dodatna karta je
// zasebna karta svoje vrste: ide na račun i SEOP dojavu svojom namjenom, a
// kapacitet troši po svojoj kategoriji (dojenče: „Ne zauzima kapacitet").
export default function ExtraTicketsEditor({ value, onChange, ticketTypes, selfUuid }) {
    const popis = Array.isArray(value) ? value : [];
    const ponuda = (ticketTypes || []).filter((t) => t.uuid !== selfUuid && t.is_active !== false);

    const postavi = (i, polje, v) => onChange(popis.map((d, j) => (j === i ? { ...d, [polje]: v } : d)));
    const ukloni = (i) => onChange(popis.filter((_, j) => j !== i));
    const dodaj = () => onChange([...popis, { ticket_type_uuid: "", max_qty: 1 }]);

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={800}>Dodatne karte</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Karte koje se uz ovu mogu dodati bez naplate (npr. dojenče uz roditelja). Prijavljuju se SEOP-u
                svojom namjenom; kapacitet troše po svojoj kategoriji.
            </Typography>
            <Stack spacing={1}>
                {popis.map((d, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                        <TextField
                            select
                            size="small"
                            label="Vrsta karte"
                            value={ponuda.some((t) => t.uuid === d.ticket_type_uuid) ? d.ticket_type_uuid : ""}
                            onChange={(e) => postavi(i, "ticket_type_uuid", e.target.value)}
                            sx={{ flex: 1 }}
                        >
                            {ponuda
                                .filter((t) => t.uuid === d.ticket_type_uuid || !popis.some((x) => x.ticket_type_uuid === t.uuid))
                                .map((t) => (
                                    <MenuItem key={t.uuid} value={t.uuid}>
                                        {t.name}{t.seop_type ? ` (${t.seop_type})` : ""}
                                    </MenuItem>
                                ))}
                        </TextField>
                        <TextField
                            size="small"
                            type="number"
                            label="Max po karti"
                            value={d.max_qty ?? 1}
                            onChange={(e) => postavi(i, "max_qty", Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                            inputProps={{ min: 1, max: 20 }}
                            sx={{ width: 130 }}
                        />
                        <IconButton onClick={() => ukloni(i)} aria-label="Ukloni"><DeleteOutlineIcon /></IconButton>
                    </Stack>
                ))}
            </Stack>
            <Button size="small" startIcon={<AddIcon />} onClick={dodaj} sx={{ mt: 1 }}>
                Dodaj dodatnu kartu
            </Button>
        </Box>
    );
}
