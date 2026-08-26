import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import {
    fetchBillingDevicesFullThunk,
    fetchBusinessPremisesListThunk,
    fetchSalesPricesThunk,
    fetchSalesRoutesThunk,
    fetchStornoPercentagesThunk,
    financeSliceData,
    transferTicketsThunk,
} from "../../financeSlice";
import { authSliceData } from "../../../auth/authSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

// "DD/MM/YYYY" (kako polasci stoje u bazi) <-> "YYYY-MM-DD" (input type=date)
const uIso = (s) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || ""));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const izIso = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

// Pomaknut polazak — prodaje se po stvarnom vremenu, planirano ostaje vozni red.
const samoVrijeme = (v) => {
    const m = /(\d{1,2}):(\d{2})/.exec(String(v || ""));
    return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "";
};
const jePomaknut = (r) => !!(r?.departure && r?.actual_departure && r.departure !== r.actual_departure);
const vrijemePolaska = (r) => (jePomaknut(r) ? samoVrijeme(r.actual_departure) : (r?.departure_time || ""));

export default function TransferTicketsModal({ open, tickets, onClose, onTransferred }) {
    const dispatch = useDispatch();
    const {
        billingDevicesFull,
        businessPremisesList,
        stornoPercentages,
        salesRoutes,
        salesPrices,
        transferLoading,
    } = useSelector(financeSliceData);
    const auth = useSelector(authSliceData);

    const [terminal, setTerminal] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [percentageUuid, setPercentageUuid] = useState("");
    const [datum, setDatum] = useState("");
    const [linija, setLinija] = useState("");
    const [odLuke, setOdLuke] = useState("");
    const [polazak, setPolazak] = useState("");     // "timetable_uuid-sequence"
    const [doLuke, setDoLuke] = useState("");
    const [greska, setGreska] = useState(null);

    useEffect(() => {
        if (!open) return;
        if (!billingDevicesFull.length) dispatch(fetchBillingDevicesFullThunk());
        if (!businessPremisesList.length) dispatch(fetchBusinessPremisesListThunk());
        if (!stornoPercentages.length) dispatch(fetchStornoPercentagesThunk());
        if (!salesRoutes.length) dispatch(fetchSalesRoutesThunk());
        if (!salesPrices.length) dispatch(fetchSalesPricesThunk());
    }, [open, dispatch, billingDevicesFull.length, businessPremisesList.length,
        stornoPercentages.length, salesRoutes.length, salesPrices.length]);

    useEffect(() => {
        if (open) {
            setGreska(null);
            // Polazi se od dana i linije stare karte — promjena je najčešće na
            // drugi polazak iste linije, pa je to najmanje klikanja.
            const prva = tickets[0];
            setDatum(uIso(prva?.departure_planed) || new Date().toISOString().slice(0, 10));
            setLinija(prva?.line_code || "");
            setOdLuke(prva?.departure_harbor_id || "");
            setDoLuke("");
            setPolazak("");
        } else {
            setTerminal("");
            setPaymentMethod("");
            setPercentageUuid("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => { setPaymentMethod(""); }, [terminal]);

    // --- uređaji: tip URED, i to samo oni na kojima operater ima ovlasti ----
    const operatorUuid = auth?.loggedUserData?.uuid || auth?.loggedUserData?.user_uuid || "";
    const officeBpUuids = useMemo(
        () => new Set(businessPremisesList
            .filter((bp) => String(bp.type || "").toUpperCase() === "URED")
            .map((bp) => bp.uuid)),
        [businessPremisesList]
    );
    const officeDevices = useMemo(
        () => billingDevicesFull.filter((bd) =>
            bd.is_active
            && officeBpUuids.has(bd.business_premise_uuid)
            && (bd.permissions || []).some((p) => p.uuid === operatorUuid)),
        [billingDevicesFull, officeBpUuids, operatorUuid]
    );
    useEffect(() => {
        if (open && !terminal && officeDevices.length === 1) setTerminal(officeDevices[0].uuid);
    }, [open, terminal, officeDevices]);

    const odabraniUredaj = officeDevices.find((bd) => bd.uuid === terminal);
    const sredstva = (odabraniUredaj?.payment || odabraniUredaj?.payment_methods || [])
        .filter((pm) => pm.is_active);

    // --- odabir novog polaska ----------------------------------------------
    const linije = useMemo(
        () => [...new Map(salesRoutes.map((r) => [r.line_code, r.line_name])).entries()]
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => String(a.code).localeCompare(String(b.code))),
        [salesRoutes]
    );

    const lukePolaska = useMemo(() => {
        if (!linija) return [];
        const m = new Map();
        for (const r of salesRoutes) {
            if (r.line_code === linija) m.set(r.departure_harbor_id, r.departure_harbor_name);
        }
        return [...m.entries()].map(([id, name]) => ({ id, name }));
    }, [salesRoutes, linija]);

    const polasci = useMemo(() => {
        if (!linija || !odLuke || !datum) return [];
        const dmy = izIso(datum);
        const vidjeni = new Set();
        const out = [];
        for (const r of salesRoutes) {
            if (r.line_code !== linija || r.departure_harbor_id !== odLuke || r.departure_date !== dmy) continue;
            const key = `${r.timetable_uuid}-${r.sequence}`;
            if (vidjeni.has(key)) continue;
            vidjeni.add(key);
            out.push(r);
        }
        return out.sort((a, b) => vrijemePolaska(a).localeCompare(vrijemePolaska(b)));
    }, [salesRoutes, linija, odLuke, datum]);

    const odabraniPolazak = polasci.find((r) => `${r.timetable_uuid}-${r.sequence}` === polazak);

    // Relacije nizvodno od odabranog polaska — isto pravilo kao u POS-u.
    const relacije = useMemo(() => {
        if (!odabraniPolazak) return [];
        return salesRoutes.filter((r) =>
            r.timetable_uuid === odabraniPolazak.timetable_uuid
            && r.sequence === odabraniPolazak.sequence
            && r.departure_date === odabraniPolazak.departure_date
            && r.departure_harbor_id === odabraniPolazak.departure_harbor_id
            && Number(r.arrival_harbor_order) > Number(r.departure_harbor_order)
        );
    }, [salesRoutes, odabraniPolazak]);

    const odabranaRelacija = relacije.find((r) => r.arrival_harbor_id === doLuke);

    // --- iznosi -------------------------------------------------------------
    const postotak = useMemo(() => {
        const p = stornoPercentages.find((x) => x.uuid === percentageUuid);
        return p ? Number(p.percentage) : null;
    }, [stornoPercentages, percentageUuid]);

    const placeno = useMemo(
        () => +tickets.reduce((s, t) => s + (parseFloat(t.single_price) || 0), 0).toFixed(2),
        [tickets]
    );
    const priznato = useMemo(
        () => (postotak == null ? 0 : +(placeno * postotak / 100).toFixed(2)),
        [placeno, postotak]
    );

    // Nove karte: isti tipovi kao stare, po cijeni odabrane relacije.
    // Grupira se po tipu, a redoslijed grupa je i redoslijed uparivanja stare
    // karte s novom — zato se svugdje ide istim sortiranjem.
    const poTipu = useMemo(() => {
        const m = new Map();
        for (const t of [...tickets].sort((a, b) =>
            String(a.ticket_type_uuid).localeCompare(String(b.ticket_type_uuid)))) {
            const k = t.ticket_type_uuid;
            if (!m.has(k)) m.set(k, { ticket_type_uuid: k, ticket_type_name: t.ticket_type_name, karte: [] });
            m.get(k).karte.push(t);
        }
        return [...m.values()];
    }, [tickets]);

    const cijenaZaTip = (ticket_type_uuid) => {
        if (!odabranaRelacija) return null;
        const p = salesPrices.find((x) =>
            x.timetable_uuid === odabranaRelacija.timetable_uuid
            && x.harbor_from_code === odabranaRelacija.departure_harbor_id
            && x.harbor_to_code === odabranaRelacija.arrival_harbor_id
            && x.ticket_type_uuid === ticket_type_uuid
            && x.is_active !== false);
        return p ? Number(p.price) : null;
    };

    const noveStavke = useMemo(() => poTipu.map((g) => ({
        ...g,
        qty: g.karte.length,
        unit_price: cijenaZaTip(g.ticket_type_uuid),
    })), [poTipu, odabranaRelacija, salesPrices]);

    const bezCijene = noveStavke.filter((s) => s.unit_price == null);
    const novoUkupno = useMemo(
        () => +noveStavke.reduce((s, x) => s + (x.unit_price || 0) * x.qty, 0).toFixed(2),
        [noveStavke]
    );
    const razlika = +(novoUkupno - priznato).toFixed(2);

    // --- provjere -----------------------------------------------------------
    const istiRacun = useMemo(() => {
        const kljucevi = new Set(tickets.map((t) => t.order_uuid || t.order_number || ""));
        return kljucevi.size <= 1;
    }, [tickets]);

    const mozeSlati =
        !transferLoading
        && tickets.length > 0
        && istiRacun
        && postotak != null
        && odabranaRelacija
        && !bezCijene.length
        && terminal
        && paymentMethod;

    const posalji = async () => {
        setGreska(null);
        const op = auth?.loggedUserData || {};
        const route = {
            route_uuid: odabranaRelacija.uuid,
            line_code: odabranaRelacija.line_code,
            line_name: odabranaRelacija.line_name,
            departure_harbor_id: odabranaRelacija.departure_harbor_id,
            departure_harbor_name: odabranaRelacija.departure_harbor_name,
            arrival_harbor_id: odabranaRelacija.arrival_harbor_id,
            arrival_harbor_name: odabranaRelacija.arrival_harbor_name,
            departure_planned: `${odabranaRelacija.departure_date} ${odabranaRelacija.departure_time || ""}`.trim(),
            arrival_planned: odabranaRelacija.actual_arrival || odabranaRelacija.arrival || "",
        };
        const res = await dispatch(transferTicketsThunk({
            sale: {
                items: noveStavke.map((s) => ({
                    ticket_type_uuid: s.ticket_type_uuid,
                    ticket_type_name: s.ticket_type_name,
                    qty: s.qty,
                    unit_price: s.unit_price,
                    route,
                })),
                terminal_uuid: terminal,
                payment_method_uuid: paymentMethod,
                transfer_credit: {
                    amount: priznato,
                    percentage: postotak,
                    source_ticket_codes: tickets.map((t) => t.ticket_code).filter(Boolean),
                },
                operator: {
                    uuid: op.uuid || op.user_uuid,
                    username: op.username,
                    name: op.name || op.full_name,
                    mark: op.mark,
                    oib: op.legal_id || op.user_legal_id || op.oib,
                },
                buyer: {},
            },
            // Redoslijed mora pratiti redoslijed stavki, jer se stare i nove
            // karte uparuju po redu kojim ih backend stvori.
            source_ticket_uuids: poTipu.flatMap((g) => g.karte.map((t) => t.ticket_uuid)),
            percentage: postotak,
        }));
        if (res.meta.requestStatus === "fulfilled") {
            if (onTransferred) onTransferred(res.payload);
            onClose();
        } else {
            setGreska(res.payload?.message || "Promjena nije uspjela");
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Prebacivanje karata na drugi polazak</DialogTitle>
            <DialogContent dividers>
                {tickets.length === 0 ? (
                    <Alert severity="info">Nema odabranih karata.</Alert>
                ) : !istiRacun ? (
                    <Alert severity="error">
                        Odabrane karte nisu s istog računa. Promjena se radi po računu, jer se razlika
                        naplaćuje jednim novim računom.
                    </Alert>
                ) : (
                    <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Karata u promjeni</Typography>
                            <Typography fontWeight={700}>{tickets.length}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Plaćeno po starim kartama</Typography>
                            <Typography fontWeight={700}>{fmtEUR(placeno)}</Typography>
                        </Stack>

                        <TextField
                            select
                            label="Koliko se priznaje"
                            value={percentageUuid}
                            onChange={(e) => setPercentageUuid(e.target.value)}
                            required
                            fullWidth
                        >
                            {stornoPercentages.filter((p) => p.is_active !== false).map((p) => (
                                <MenuItem key={p.uuid} value={p.uuid}>
                                    {p.name} · {Number(p.percentage)}%
                                </MenuItem>
                            ))}
                        </TextField>

                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Priznati iznos</Typography>
                            <Typography fontWeight={700}>{fmtEUR(priznato)}</Typography>
                        </Stack>

                        <Divider>Novi polazak</Divider>

                        <Stack direction="row" spacing={2}>
                            <TextField
                                type="date"
                                label="Datum"
                                value={datum}
                                onChange={(e) => { setDatum(e.target.value); setPolazak(""); setDoLuke(""); }}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                            />
                            <TextField
                                select
                                label="Linija"
                                value={linija}
                                onChange={(e) => { setLinija(e.target.value); setOdLuke(""); setPolazak(""); setDoLuke(""); }}
                                fullWidth
                            >
                                {linije.map((l) => (
                                    <MenuItem key={l.code} value={l.code}>{l.code} · {l.name}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>

                        <Stack direction="row" spacing={2}>
                            <TextField
                                select
                                label="Od luke"
                                value={odLuke}
                                onChange={(e) => { setOdLuke(e.target.value); setPolazak(""); setDoLuke(""); }}
                                disabled={!linija}
                                fullWidth
                            >
                                {lukePolaska.map((h) => (
                                    <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                label="Polazak"
                                value={polazak}
                                onChange={(e) => { setPolazak(e.target.value); setDoLuke(""); }}
                                disabled={!odLuke}
                                fullWidth
                                helperText={odLuke && !polasci.length ? "Nema polazaka za taj dan" : ""}
                            >
                                {polasci.map((r) => (
                                    <MenuItem key={`${r.timetable_uuid}-${r.sequence}`} value={`${r.timetable_uuid}-${r.sequence}`}>
                                        {vrijemePolaska(r)} · smjer {r.direction}
                                        {jePomaknut(r) ? ` (pomaknut, po redu ${r.departure_time})` : ""}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                label="Do luke"
                                value={doLuke}
                                onChange={(e) => setDoLuke(e.target.value)}
                                disabled={!polazak}
                                fullWidth
                            >
                                {relacije.map((r) => (
                                    <MenuItem key={r.uuid} value={r.arrival_harbor_id}>{r.arrival_harbor_name}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>

                        {odabranaRelacija && (
                            <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5 }}>
                                {noveStavke.map((s) => (
                                    <Stack key={s.ticket_type_uuid} direction="row" justifyContent="space-between">
                                        <Typography variant="body2">
                                            {s.ticket_type_name} × {s.qty}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={700}>
                                            {s.unit_price == null ? "nema cijene" : fmtEUR(s.unit_price * s.qty)}
                                        </Typography>
                                    </Stack>
                                ))}
                            </Box>
                        )}

                        {bezCijene.length > 0 && (
                            <Alert severity="warning">
                                Za relaciju nema cijene za: {bezCijene.map((s) => s.ticket_type_name).join(", ")}.
                            </Alert>
                        )}

                        <Divider />

                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Nove karte</Typography>
                            <Typography fontWeight={700}>{fmtEUR(novoUkupno)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Priznato sa starih</Typography>
                            <Typography fontWeight={700}>− {fmtEUR(priznato)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography fontWeight={800}>
                                {razlika >= 0 ? "Za naplatu" : "Za povrat"}
                            </Typography>
                            <Typography fontWeight={800} color={razlika >= 0 ? "success.main" : "error"}>
                                {fmtEUR(Math.abs(razlika))}
                            </Typography>
                        </Stack>

                        <Stack direction="row" spacing={2}>
                            <TextField
                                select
                                label="Naplatni uređaj (URED)"
                                value={terminal}
                                onChange={(e) => setTerminal(e.target.value)}
                                required
                                fullWidth
                                helperText={!officeDevices.length
                                    ? "Nemaš ovlasti ni na jednom uređaju u poslovnom prostoru tipa URED"
                                    : ""}
                            >
                                {officeDevices.map((bd) => (
                                    <MenuItem key={bd.uuid} value={bd.uuid}>
                                        {bd.name} {bd.fiscal_mark ? `· ${bd.fiscal_mark}` : ""}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                label={razlika >= 0 ? "Sredstvo plaćanja" : "Sredstvo povrata"}
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                required
                                disabled={!terminal || !sredstva.length}
                                fullWidth
                            >
                                {sredstva.map((pm) => (
                                    <MenuItem key={pm.uuid} value={pm.uuid}>{pm.name}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>

                        {greska && <Alert severity="error">{greska}</Alert>}

                        <Alert severity="info">
                            Izdaje se novi račun: nove karte punom cijenom, umanjene za priznati iznos sa
                            starih. Stare karte prestaju vrijediti i vežu se na nove.
                        </Alert>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={transferLoading}>Odustani</Button>
                <Button variant="contained" onClick={posalji} disabled={!mozeSlati}>
                    {transferLoading ? "Izdavanje…" : "Prebaci i izdaj račun"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
