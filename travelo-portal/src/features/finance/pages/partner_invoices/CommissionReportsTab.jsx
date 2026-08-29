import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Alert,
    Box,
    Button,
    Chip,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import {
    dohvatiDetaljeProvizije,
    fetchPartnerCommissionThunk,
    fetchPartnersListThunk,
    financeSliceData,
} from "../../financeSlice";
import { setAuthData } from "../../../auth/authSlice";
import { izveziObracunProvizije } from "../partner_commission/provizijaExcel";
import { izveziDetaljeProvizije, pripadaRetku } from "../partner_commission/detaljiExcel";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;

const hrDatum = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(iso || "");
};

// Izvještaj o proviziji — podloga po kojoj partner nama ispostavlja račun.
//
// Obuhvaća isključivo prodaju koju je odradio u naše ime, na svom prodajnom
// mjestu s našom opremom: taj je novac naš, a njemu pripada provizija. Prodaja
// za njegov vlastiti račun ovdje NE ulazi — ondje ide obrnuto, mi njemu
// fakturiramo karte, i to je prvi tab.
export default function CommissionReportsTab() {
    const dispatch = useDispatch();
    const finance = useSelector(financeSliceData);

    const [partnerUuid, setPartnerUuid] = useState("");
    const [trazeno, setTrazeno] = useState(false);

    const obracun = finance.partnerCommission || {};
    const partner = (obracun.partners || [])[0] || null;
    const razdoblje = obracun.period || null;

    const odabraniPartner = useMemo(
        () => (finance.partnersList || []).find((p) => p.uuid === partnerUuid) || null,
        [finance.partnersList, partnerUuid]
    );

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
        if (!(finance.partnersList || []).length) dispatch(fetchPartnersListThunk());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const prikazi = async () => {
        if (!partnerUuid) return;
        dispatch(setAuthData({ path: "loadingMessage", value: "Priprema izvještaja…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        // Razdoblje se ne bira ovdje: obračunava se ono koje proizlazi iz
        // dinamike naplate partnera, isto ono po kojem se izdaje i račun.
        await dispatch(fetchPartnerCommissionThunk({ partner_uuid: partnerUuid }));
        setTrazeno(true);
        dispatch(setAuthData({ path: "loading", value: false }));
    };

    const preuzmiIzvjestaj = () => {
        if (!partner) return;
        izveziObracunProvizije({
            partneri: [partner],
            totals: obracun.totals,
            from: obracun.from,
            to: obracun.to,
            partner: odabraniPartner,
        });
    };

    // Karte iza iznosa — partner ih traži kad usklađuje svoj račun s našim
    // izvještajem. Dohvaćaju se tek na klik, popis zna imati stotine redaka.
    const preuzmiKarte = async () => {
        if (!partner) return;
        dispatch(setAuthData({ path: "loadingMessage", value: "Priprema detalja…" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        try {
            const svi = await dohvatiDetaljeProvizije({
                partner_uuid: partnerUuid,
                from: obracun.from,
                to: obracun.to,
            });
            izveziDetaljeProvizije({
                redci: svi.filter((r) => pripadaRetku(r, { scope: "company" })),
                partner: partner.partner_name,
                from: obracun.from,
                to: obracun.to,
                opis: "podloga za račun provizije",
            });
        } finally {
            dispatch(setAuthData({ path: "loading", value: false }));
        }
    };

    return (
        <Box sx={{ mt: 2, ml: 2, width: "98%", overflowX: "auto" }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <TextField
                        select
                        label="Partner"
                        value={partnerUuid}
                        onChange={(e) => { setPartnerUuid(e.target.value); setTrazeno(false); }}
                        sx={{ minWidth: 280 }}
                    >
                        {(finance.partnersList || []).map((p) => (
                            <MenuItem key={p.uuid} value={p.uuid}>
                                {p.partner_name}{!p.is_active ? " (neaktivan)" : ""}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={prikazi}
                        disabled={finance.partnerCommissionLoading || !partnerUuid}
                    >
                        Prikaži
                    </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Izvještaj obuhvaća prodaju koju je partner odradio za naš račun. To je podloga po
                    kojoj nam on ispostavlja račun za proviziju. Razdoblje se određuje iz dinamike
                    naplate partnera.
                </Typography>
            </Paper>

            {finance.partnerCommissionError ? (
                <Alert severity="error" sx={{ mb: 2 }}>{finance.partnerCommissionError}</Alert>
            ) : null}

            {trazeno && !partner ? (
                <Alert severity="info">
                    Partner u obračunskom razdoblju
                    {obracun.from && obracun.to ? ` (${hrDatum(obracun.from)} – ${hrDatum(obracun.to)})` : ""} nije
                    prodavao za naš račun, pa nema osnove za račun provizije.
                </Alert>
            ) : null}

            {partner ? (
                <Paper variant="outlined">
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
                    >
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontWeight: 800 }}>
                                Izvještaj za proviziju · {partner.partner_name}
                                {partner.partner_legal_id ? ` · OIB ${partner.partner_legal_id}` : ""}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Razdoblje {hrDatum(obracun.from)} – {hrDatum(obracun.to)}
                                {/* Naziv razdoblja dolazi s poslužitelja, iz iste dinamike po
                                    kojoj se izdaje i račun — da se ne razilaze. */}
                                {razdoblje?.label ? ` · ${razdoblje.label.toLowerCase()}` : ""}
                                {obracun.company_name ? ` · prodano u ime i za račun: ${obracun.company_name}` : ""}
                            </Typography>
                        </Box>
                        <Chip size="small" color="primary" label={`provizija ${Number(partner.commission_pct).toFixed(2)} %`} />
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ReceiptLongOutlinedIcon />}
                            onClick={preuzmiIzvjestaj}
                        >
                            Preuzmi izvještaj
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={preuzmiKarte}
                        >
                            Preuzmi karte
                        </Button>
                    </Stack>

                    <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Prodajno mjesto</TableCell>
                                    <TableCell>Naplatni uređaj</TableCell>
                                    <TableCell>Operater</TableCell>
                                    <TableCell align="right">Karata</TableCell>
                                    <TableCell align="right">Promet</TableCell>
                                    <TableCell align="right">Osnovica</TableCell>
                                    <TableCell align="right">Provizija</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(partner.premises || []).map((m) => (
                                    (m.rows || []).map((r, i) => (
                                        <TableRow key={`${m.business_premise_uuid}-${r.billing_device}-${r.operator}`} hover>
                                            {/* Naziv mjesta samo uz prvi redak, da se ne ponavlja niz stupac. */}
                                            <TableCell>{i === 0 ? m.business_premise_name : ""}</TableCell>
                                            <TableCell>{r.billing_device || "—"}</TableCell>
                                            <TableCell>{r.operator || "—"}</TableCell>
                                            <TableCell align="right">{r.tickets}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.base)}</TableCell>
                                            <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                                        </TableRow>
                                    ))
                                ))}
                                <TableRow>
                                    <TableCell colSpan={3} sx={{ fontWeight: 800 }}>Ukupno za fakturirati</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{partner.tickets}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(partner.gross)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(partner.base)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 900 }}>{fmtEUR(partner.commission)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
                        Osnovica je promet bez lučke pristojbe i bez PDV-a. Provizija se računa na
                        zbroj osnovice, a ne po karti — zaokruživanje po karti bi na većem broju
                        karata odstupilo od iznosa koji se stvarno plaća.
                    </Typography>
                </Paper>
            ) : null}
        </Box>
    );
}
