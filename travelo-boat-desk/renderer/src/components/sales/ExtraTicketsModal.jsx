import { useMemo, useState } from "react";
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { allAppData, setStateData } from "../../store/appSlice";

// Dodatne karte uz kartu roditelja (npr. dojenče uz Redovnu) — bez naplate.
//
// Koje se dodatne smiju dodati i koliko po karti, određuje vrsta karte u
// portalu (Brod → Vrste karata → Dodatne karte). Dodatna je u košarici zasebna
// stavka od 0 € s oznakom `dodatna`; uz kartu roditelja ide i na račun, na
// kartu roditelja se ispisuje kao „+ Dodatno", a poslužitelj je dojavljuje
// SEOP-u njezinom namjenom.

// Koliko je karata roditelja te vrste na relaciji (obične i povlaštene).
export const kolicinaRoditelja = (sve, salesRouteUuid, tipUuid) =>
    (sve || [])
        .filter((t) => t.sales_route_uuid === salesRouteUuid && t.ticket_type_uuid === tipUuid && !t.dodatna)
        .reduce((z, t) => z + (Number(t.quantity) || 0), 0);

// Dodatne ne smiju nadmašiti „max po karti × broj karata roditelja". Kad se
// karta roditelja smanji ili ukloni, višak dodatnih nestaje. Vraća isti niz
// ako nema promjene.
export const uskladiDodatne = (sve) => {
    let promjena = false;
    const out = [];
    for (const t of sve || []) {
        if (!t.dodatna) { out.push(t); continue; }
        const dopusteno = (Number(t.dodatna.max_qty) || 1) * kolicinaRoditelja(sve, t.sales_route_uuid, t.dodatna.roditelj_tip);
        const kol = Number(t.quantity) || 0;
        if (kol <= dopusteno) { out.push(t); continue; }
        promjena = true;
        if (dopusteno > 0) {
            out.push({ ...t, quantity: dopusteno, tickets: (t.tickets || []).slice(0, dopusteno) });
        }
    }
    return promjena ? out : sve;
};

export default function ExtraTicketsModal({ row, roditeljTipovi, onClose }) {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const sve = appData.saleData?.addedTickets || [];
    const veze = appData.basicData?.ticket_type_extras || [];

    // Roditelji na ovoj relaciji koji imaju dodatne karte.
    const roditelji = useMemo(() => (roditeljTipovi || [])
        .map((tip) => {
            const prvi = sve.find((t) => t.sales_route_uuid === row.sales_route_uuid && t.ticket_type_uuid === tip && !t.dodatna);
            return {
                tip,
                naziv: prvi?.ticket_type_name || "",
                kolicina: kolicinaRoditelja(sve, row.sales_route_uuid, tip),
                prvi,
                dodatne: veze.filter((v) => v.parent_ticket_type_uuid === tip),
            };
        })
        .filter((r) => r.kolicina > 0 && r.dodatne.length), [roditeljTipovi, sve, veze, row.sales_route_uuid]);

    const kljuc = (roditelj, dodatna) => `${roditelj}|${dodatna}`;
    const postojeca = (roditelj, dodatna) => sve.find((t) => t.sales_route_uuid === row.sales_route_uuid
        && t.dodatna?.roditelj_tip === roditelj && t.ticket_type_uuid === dodatna);

    const [kolicine, setKolicine] = useState(() => {
        const k = {};
        for (const r of roditelji) for (const d of r.dodatne) k[kljuc(r.tip, d.ticket_type_uuid)] = Number(postojeca(r.tip, d.ticket_type_uuid)?.quantity) || 0;
        return k;
    });

    const promijeni = (r, d, za) => {
        const max = (Number(d.max_qty) || 1) * r.kolicina;
        const k = kljuc(r.tip, d.ticket_type_uuid);
        setKolicine((s) => ({ ...s, [k]: Math.max(0, Math.min(max, (s[k] || 0) + za)) }));
    };

    const spremi = () => {
        let nove = [...sve];
        for (const r of roditelji) {
            for (const d of r.dodatne) {
                const kol = kolicine[kljuc(r.tip, d.ticket_type_uuid)] || 0;
                const stara = postojeca(r.tip, d.ticket_type_uuid);
                nove = nove.filter((t) => t !== stara);
                if (!kol) continue;
                const tickets = (stara?.tickets || []).slice(0, kol);
                while (tickets.length < kol) tickets.push({ uuid: uuid(), code: uuid() });
                const p = r.prvi || {};
                nove.push({
                    id: uuid(),
                    sales_route_uuid: row.sales_route_uuid,
                    line_code: p.line_code,
                    line_name: p.line_name,
                    departure: p.departure,
                    departure_harbor_id: p.departure_harbor_id,
                    departure_harbor_name: p.departure_harbor_name,
                    arrival: p.arrival,
                    arrival_harbor_id: p.arrival_harbor_id,
                    arrival_harbor_name: p.arrival_harbor_name,
                    ticket_type_name: `${d.ticket_type_name} – dodatna`,
                    ticket_type_id: null,
                    ticket_type_uuid: d.ticket_type_uuid,
                    ticket_group_uuid: stara?.ticket_group_uuid || uuid(),
                    single_price: 0,
                    unit_vat_base: 0,
                    unit_vat: 0,
                    unit_harbor_tax: 0,
                    total_price: 0,
                    total_vat_base: 0,
                    total_vat: 0,
                    total_harbor_tax: 0,
                    quantity: kol,
                    tickets,
                    dodatna: {
                        roditelj_tip: r.tip,
                        max_qty: Number(d.max_qty) || 1,
                        seop_type: d.seop_type || null,
                        naziv: d.ticket_type_name,
                    },
                });
            }
        }
        dispatch(setStateData({ path: "saleData/addedTickets", value: nove }));
        onClose();
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                Dodatne karte
                <Typography variant="body2" color="text.secondary">
                    {row.departure_harbor_name} – {row.arrival_harbor_name} · bez naplate
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {!roditelji.length ? (
                    <Typography color="text.secondary">Za karte u košarici nema dodatnih karata.</Typography>
                ) : roditelji.map((r) => (
                    <Box key={r.tip} sx={{ mb: 2 }}>
                        <Typography sx={{ fontWeight: 700 }}>
                            Uz: {r.naziv} × {r.kolicina}
                        </Typography>
                        {r.dodatne.map((d) => {
                            const k = kljuc(r.tip, d.ticket_type_uuid);
                            const max = (Number(d.max_qty) || 1) * r.kolicina;
                            return (
                                <Stack key={k} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                                    <Box>
                                        <Typography>{d.ticket_type_name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            najviše {d.max_qty} po karti — ukupno {max}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <IconButton onClick={() => promijeni(r, d, -1)} disabled={!kolicine[k]}><RemoveIcon /></IconButton>
                                        <Typography sx={{ minWidth: 28, textAlign: "center", fontWeight: 800, fontSize: "1.2rem" }}>
                                            {kolicine[k] || 0}
                                        </Typography>
                                        <IconButton onClick={() => promijeni(r, d, +1)} disabled={(kolicine[k] || 0) >= max}><AddIcon /></IconButton>
                                    </Stack>
                                </Stack>
                            );
                        })}
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Odustani</Button>
                <Button variant="contained" onClick={spremi} disabled={!roditelji.length}>Spremi</Button>
            </DialogActions>
        </Dialog>
    );
}
