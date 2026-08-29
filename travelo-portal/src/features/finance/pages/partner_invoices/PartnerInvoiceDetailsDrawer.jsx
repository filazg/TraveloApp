import {
    Box,
    Button,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { preuzmiPartnerRacunPdf } from "../../financeSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
// Polazak je tekst "DD.MM.YYYY. HH:mm"; new Date() ga ne parsira, pa se za
// redoslijed slaže ručno. Nepoznat oblik ide na kraj, da ne poremeti niz.
const uSekunde = (s) => {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*(\d{1,2}):(\d{2})/.exec(String(s || ""));
    if (!m) return Number.MAX_SAFE_INTEGER;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
};

const fmtDateTime = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString("hr-HR");
};

// Razrada iza računa — što je točno prodano i kada.
//
// Ne stoji na samom računu: račun je dokument s nekoliko stavaka i tako se i
// čita, a razrada zna imati stotine karata. Otvara se zasebno, kad se iznos
// provjerava ili usklađuje s partnerovom evidencijom.
export default function PartnerInvoiceDetailsDrawer({ invoice, items = [], onClose }) {
    if (!invoice) return null;

    return (
        <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={800}>
                        Detalji računa #{invoice.partner_invoice_no}/{invoice.invoice_year}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {invoice.partner_name} · {invoice.tickets_count} karata
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    {/* Ista razrada kao na ekranu, u obliku koji se salje dalje. */}
                    <Button
                        variant="outlined"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() => preuzmiPartnerRacunPdf(invoice.partner_invoice_uuid, { detalji: true })}
                    >
                        PDF
                    </Button>
                    <Button onClick={onClose} startIcon={<CloseIcon />}>Zatvori</Button>
                </Stack>
            </Stack>

            <RouteSummarySection items={items} />
            <Box sx={{ my: 3 }} />
            <UserAnalyticsSection items={items} />
        </Box>
    );
}

// Rezime po polascima — jedan redak po vožnji, jer se račun najčešće provjerava
// tako da se pita "koliko je prodano za koji polazak". Jedan polazak je jedan
// route_uuid, pa se po njemu i grupira.
function RouteSummarySection({ items }) {
    const groups = groupBy(items, (it) => it.route_uuid || "—");
    const rows = Object.entries(groups).map(([route_uuid, arr]) => {
        const first = arr[0];
        const line = [first.line_code, first.line_name].filter(Boolean).join(" · ");
        const relation = [first.departure_harbor_name, first.arrival_harbor_name].filter(Boolean).join(" → ");
        const count = arr.length;
        const gross = arr.reduce((s, x) => s + Number(x.gross_amount || 0), 0);
        const commission = arr.reduce((s, x) => s + Number(x.commission_amount || 0), 0);
        const net = arr.reduce((s, x) => s + Number(x.net_amount || 0), 0);
        return { route_uuid, departure: first.departure, line, relation, count, gross, commission, net };
    }).sort((a, b) => uSekunde(a.departure) - uSekunde(b.departure));

    const zbroj = (k) => rows.reduce((s, r) => s + r[k], 0);

    return (
        <>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Rezime po polascima
            </Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Polazak</TableCell>
                            <TableCell>Linija</TableCell>
                            <TableCell>Relacija</TableCell>
                            <TableCell align="right">Karte</TableCell>
                            <TableCell align="right">Bruto</TableCell>
                            <TableCell align="right">Provizija</TableCell>
                            <TableCell align="right">Osnovica za PDV</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.route_uuid} hover>
                                <TableCell>{r.departure || "—"}</TableCell>
                                <TableCell>{r.line}</TableCell>
                                <TableCell>{r.relation}</TableCell>
                                <TableCell align="right">{r.count}</TableCell>
                                <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.net)}</TableCell>
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Typography variant="body2" color="text.secondary">Nema stavki</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={3} sx={{ fontWeight: 800 }}>
                                    Ukupno ({rows.length} {rows.length === 1 ? "polazak" : "polazaka"})
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{zbroj("count")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj("gross"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj("commission"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj("net"))}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
}

// Analitika po korisniku — tko je od partnerovih ljudi koliko prodao.
//
// Partner svoje ljude placa i prati po tome, a s racuna se to inace ne vidi:
// stavke znaju sto je prodano, ali ne i tko stoji iza toga. Kod partnerske web
// prodaje to je korisnicko ime, kod API prodaje TID terminala.
function UserAnalyticsSection({ items }) {
    const groups = groupBy(items, (it) => it.sold_by_username || "—");
    const rows = Object.entries(groups).map(([korisnik, arr]) => {
        // Prodaja je jedan potez, ne jedna karta: nekoliko karata odjednom je
        // jedna prodaja, i partner ih tako i broji.
        const prodaja = new Set(arr.map((x) => x.order_uuid || `karta:${x.ticket_uuid}`)).size;
        const vremena = arr.map((x) => (x.sale_datetime ? new Date(x.sale_datetime).getTime() : null)).filter((v) => v != null);
        return {
            korisnik,
            prodaja,
            karte: arr.length,
            gross: arr.reduce((s, x) => s + Number(x.gross_amount || 0), 0),
            commission: arr.reduce((s, x) => s + Number(x.commission_amount || 0), 0),
            net: arr.reduce((s, x) => s + Number(x.net_amount || 0), 0),
            prva: vremena.length ? new Date(Math.min(...vremena)).toISOString() : null,
            zadnja: vremena.length ? new Date(Math.max(...vremena)).toISOString() : null,
        };
    }).sort((a, b) => b.gross - a.gross);

    const zbroj = (k) => rows.reduce((s, r) => s + r[k], 0);

    return (
        <>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Analitika po korisniku
            </Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Korisnik</TableCell>
                            <TableCell align="right">Prodaja</TableCell>
                            <TableCell align="right">Karte</TableCell>
                            <TableCell>Prva prodaja</TableCell>
                            <TableCell>Zadnja prodaja</TableCell>
                            <TableCell align="right">Bruto</TableCell>
                            <TableCell align="right">Provizija</TableCell>
                            <TableCell align="right">Osnovica za PDV</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.korisnik} hover>
                                <TableCell>{r.korisnik}</TableCell>
                                <TableCell align="right">{r.prodaja}</TableCell>
                                <TableCell align="right">{r.karte}</TableCell>
                                <TableCell>{fmtDateTime(r.prva)}</TableCell>
                                <TableCell>{fmtDateTime(r.zadnja)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.net)}</TableCell>
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Typography variant="body2" color="text.secondary">Nema stavki</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.length > 0 && (
                            <TableRow>
                                <TableCell sx={{ fontWeight: 800 }}>Ukupno</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{zbroj("prodaja")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{zbroj("karte")}</TableCell>
                                <TableCell colSpan={2} />
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj("gross"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj("commission"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj("net"))}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
}

function groupBy(arr, keyFn) {
    const out = {};
    for (const item of arr) {
        const k = keyFn(item);
        if (!out[k]) out[k] = [];
        out[k].push(item);
    }
    return out;
}
