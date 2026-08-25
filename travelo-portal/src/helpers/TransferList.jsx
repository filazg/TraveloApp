import { Box, Button, Checkbox, List, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Typography } from "@mui/material";

// Prijenosna lista (lijevo/desno) — jedan izgled za sva mjesta u portalu:
// dozvole modula na korisniku, te sredstva plaćanja, operateri i linije na
// naplatnom uređaju. Prije je isti blok bio prepisan u svakoj formi, pa je
// svaka izgledala malo drukčije.
//
// Komponenta je samo prikaz: stanje (lijevo/desno/označeno) i rukovatelji
// ostaju u formi, jer svaka svoju listu sprema u svoje polje.

// MUI-jevi razmaci su odmjereni za dodir prstom, a ovo je popis za miša —
// s njima je u okvir stalo upola manje stavki.
const stavkaSx = { py: 0, minHeight: 30 };
const kvacicaOkvirSx = { minWidth: 28 };
const kvacicaSx = { p: 0.25 };
const stavkaTekstSx = { fontSize: 13 };

function Okvir({ naslov, items, oznaka, jeOznacen, onToggle, visina }) {
    return (
        <Paper
            variant="outlined"
            sx={{ flex: 1, minWidth: 0, borderWidth: 2, borderRadius: 2, overflow: 'hidden' }}
        >
            <Box
                sx={{
                    px: 1.5, py: 0.75,
                    bgcolor: 'action.hover',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    gap: 0.75,
                }}
            >
                <Typography variant="subtitle2" fontWeight={700} noWrap>{naslov}</Typography>
                <Typography variant="caption" color="text.secondary">({items.length})</Typography>
            </Box>
            <Box sx={{ height: visina, overflow: 'auto' }}>
                {items.length ? (
                    <List dense disablePadding component="div" role="list">
                        {items.map((value) => {
                            const labelId = `transfer-list-item-${value.id}-label`;
                            return (
                                <ListItemButton
                                    key={value.id}
                                    role="listitem"
                                    onClick={onToggle(value)}
                                    sx={stavkaSx}
                                >
                                    <ListItemIcon sx={kvacicaOkvirSx}>
                                        <Checkbox
                                            size="small"
                                            sx={kvacicaSx}
                                            checked={jeOznacen(value)}
                                            tabIndex={-1}
                                            disableRipple
                                            inputProps={{ 'aria-labelledby': labelId }}
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        id={labelId}
                                        primary={oznaka(value)}
                                        primaryTypographyProps={{ sx: stavkaTekstSx }}
                                    />
                                </ListItemButton>
                            );
                        })}
                    </List>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                        Nema stavki
                    </Typography>
                )}
            </Box>
        </Paper>
    );
}

export default function TransferList({
    lijevo,          // { naslov, items }
    desno,           // { naslov, items }
    oznaka,          // (stavka) => tekst u retku
    jeOznacen,       // (stavka) => boolean
    onToggle,        // (stavka) => () => void
    akcije,          // { sveDesno, oznaceneDesno, oznaceneLijevo, sveLijevo }
    mogucnosti,      // { sveDesno, oznaceneDesno, oznaceneLijevo, sveLijevo } — booleani
    visina = 280,
}) {
    return (
        <Stack direction='row' alignItems="stretch" sx={{ mt: 1, mb: 1, width: '100%' }} justifyContent='center'>
            <Okvir
                naslov={lijevo.naslov}
                items={lijevo.items}
                oznaka={oznaka}
                jeOznacen={jeOznacen}
                onToggle={onToggle}
                visina={visina}
            />
            <Stack direction='column' sx={{ mx: 2, minWidth: 60, justifyContent: 'center' }}>
                <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={akcije.sveDesno} disabled={!mogucnosti.sveDesno} aria-label="move all right">≫</Button>
                <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={akcije.oznaceneDesno} disabled={!mogucnosti.oznaceneDesno} aria-label="move selected right">&gt;</Button>
                <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={akcije.oznaceneLijevo} disabled={!mogucnosti.oznaceneLijevo} aria-label="move selected left">&lt;</Button>
                <Button sx={{ my: 0.5 }} variant="outlined" size="small" onClick={akcije.sveLijevo} disabled={!mogucnosti.sveLijevo} aria-label="move all left">≪</Button>
            </Stack>
            <Okvir
                naslov={desno.naslov}
                items={desno.items}
                oznaka={oznaka}
                jeOznacen={jeOznacen}
                onToggle={onToggle}
                visina={visina}
            />
        </Stack>
    );
}
