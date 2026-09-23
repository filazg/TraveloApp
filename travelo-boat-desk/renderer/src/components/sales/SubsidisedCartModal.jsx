import {
    Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";

// Popis povlaštenih karata dodijeljenih na jednoj relaciji.
//
// U košarici se povlaštene grupiraju po iskaznici, pa jedan redak ondje ne
// pokazuje ono po čemu je karta izdana: koje pravo, s kojeg otoka, koliki popust
// i odakle mu je došao. Bez toga se pogrešno izdana karta ne može ni prepoznati,
// a kamoli ukloniti — jedino što je preostajalo bilo je maknuti cijelu relaciju.
//
// Zato ovdje stoji razrađen popis i uklanjanje po pojedinoj karti.
const IZVOR = {
    seop: { label: "SEOP", color: "success" },
    lokalni_katalog: { label: "lokalni šifarnik", color: "info" },
    povjerenje: { label: "odluka operatera", color: "warning" },
};

const RAZLOZI = {
    nemoguce_ocitati: "Nemoguće očitati karticu",
    kartica_ostecena: "Kartica oštećena",
    greska_oprema: "Greška na opremi",
    prekid_komunikacije: "Prekid u komunikaciji",
};

const eur = (v) => `${Number(v || 0).toFixed(2)} EUR`;

export default function SubsidisedCartModal({ stavka, onClose }) {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    const sve = appData.saleData?.addedTickets || [];
    const karte = sve.filter(
        (t) => t.sales_route_uuid === stavka.sales_route_uuid && t.povlastica
    );

    // Naziv upisan uz pravo (Integracije → AKD → SEOP → Popusti) ima prednost
    // pred oznakom sustava, isto kao u košarici.
    const upisZaPravo = (t) => {
        const pravo = String(t.povlastica?.pravo || "").trim();
        if (!pravo) return null;
        return (appData.basicData?.seop_right_discounts || [])
            .find((r) => String(r.code || "").trim() === pravo) || null;
    };

    const naziv = (t) => upisZaPravo(t)?.ticket_label || t.ticket_type_name;

    const ukloni = (karta) => {
        const iskaznica = karta.povlastica?.identifikator?.vrijednost || null;
        // Pratnja (MOSI) postoji samo uz nositelja kartice i besplatna je — kad
        // se makne nositelj, mora otići i ona, inače u košarici ostane besplatna
        // karta bez osobe uz koju ide.
        const nositeljSPratnjom = iskaznica && !karta.povlastica?.pratnja;
        const preostale = sve.filter((t) => {
            if (t.ticket_group_uuid === karta.ticket_group_uuid) return false;
            if (nositeljSPratnjom
                && t.sales_route_uuid === karta.sales_route_uuid
                && t.povlastica?.pratnja
                && t.povlastica?.identifikator?.vrijednost === iskaznica) return false;
            return true;
        });
        dispatch(setStateData({ path: "saleData/addedTickets", value: preostale }));
        // Zadnja uklonjena karta znači da popis nema što prikazati.
        if (preostale.filter((t) => t.sales_route_uuid === stavka.sales_route_uuid && t.povlastica).length === 0) {
            onClose();
        }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                Povlaštene karte — {stavka.departure_harbor_name} – {stavka.arrival_harbor_name}
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                    {stavka.departure} · linija {stavka.line_code}
                </Typography>
            </DialogTitle>

            <DialogContent dividers>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>Karta</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>Iskaznica</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Pravo / naziv na karti</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>Otok</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }} align="right">Popust</TableCell>
                            <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }} align="right">Cijena</TableCell>
                            <TableCell sx={{ width: 44, p: 0 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {karte.map((t) => {
                            const p = t.povlastica || {};
                            const izvor = IZVOR[p.popust_izvor] || null;
                            const greska = p.greska?.razlog ? (RAZLOZI[p.greska.razlog] || p.greska.razlog) : null;
                            return (
                                <TableRow key={t.ticket_group_uuid} hover>
                                    <TableCell>
                                        <Stack spacing={0.3}>
                                            <Typography sx={{ fontWeight: 700 }}>{naziv(t)}</Typography>
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                <Chip size="small" variant="outlined" label={p.sustav || "SEOP"} />
                                                {p.pratnja && <Chip size="small" color="info" label="pratnja" />}
                                                {p.offline && <Chip size="small" color="warning" variant="outlined" label="bez provjere" />}
                                                {p.dojava_seop === false && (
                                                    <Chip size="small" variant="outlined" label="bez dojave" />
                                                )}
                                            </Stack>
                                            {/* Razlog stoji uz kartu jer je ona po njemu i izdana —
                                                u Kontroli se poslije trazi upravo ta veza. */}
                                            {greska && (
                                                <Typography variant="caption" color="warning.main">
                                                    izdano na povjerenje: {greska}
                                                    {p.greska?.napomena ? ` — ${p.greska.napomena}` : ""}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                                        {p.identifikator?.vrijednost || "—"}
                                        {p.identifikator?.vrsta && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                                {p.identifikator.vrsta}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    {/* Naziv nije svojstvo karte nego prava: upisan je uz
                                        bas tu sifru u sifarniku popusta. Zato stoje zajedno —
                                        da se vidi odakle naziv dolazi i sto treba ispraviti
                                        ako je kriv. */}
                                    <TableCell>
                                        <Stack spacing={0.3}>
                                            <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                                                {p.pravo || "—"}
                                            </Typography>
                                            {/* Naziv i opis se ne ponavljaju: naziv je upravo
                                                ono cime ured zamjenjuje sluzbeni opis iz
                                                Pravilnika. Dok naziva nema, opis je jedino sto
                                                govori o kojem je pravu rijec, pa stoji uz
                                                upozorenje da naziv treba upisati. */}
                                            {p.pravo && (upisZaPravo(t)?.ticket_label ? (
                                                <Typography variant="caption" color="text.secondary">
                                                    {upisZaPravo(t).ticket_label}
                                                </Typography>
                                            ) : (
                                                <>
                                                    <Typography variant="caption" color="warning.main">
                                                        naziv nije upisan
                                                    </Typography>
                                                    {upisZaPravo(t)?.opis && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {upisZaPravo(t).opis}
                                                        </Typography>
                                                    )}
                                                </>
                                            ))}
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>{p.otok || "—"}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                        {Number(p.popust_postotak) > 0 ? (
                                            <Stack spacing={0.3} alignItems="flex-end">
                                                <Typography sx={{ fontWeight: 700 }}>{p.popust_postotak} %</Typography>
                                                {izvor && <Chip size="small" color={izvor.color} label={izvor.label} />}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">po cjeniku</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                        <Stack spacing={0.3} alignItems="flex-end">
                                            <Typography sx={{ fontWeight: 700 }}>{eur(t.total_price)}</Typography>
                                            {Number(p.redovna_cijena) > Number(t.total_price) && (
                                                <Typography variant="caption" color="text.secondary">
                                                    redovna {eur(p.redovna_cijena)}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="right" sx={{ width: 44, p: 0 }}>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => ukloni(t)}
                                            title="Ukloni ovu kartu"
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!karte.length && (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                        Na ovoj relaciji nema povlaštenih karata.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Količina se ovdje ne mijenja: svaka karta glasi na jednu provjerenu iskaznicu.
                        Dodatna karta se izdaje kroz POVLAŠTENE KARTICE, uz novu provjeru.
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} variant="contained">ZATVORI</Button>
            </DialogActions>
        </Dialog>
    );
}
