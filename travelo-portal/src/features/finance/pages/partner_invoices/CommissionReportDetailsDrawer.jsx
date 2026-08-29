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
import { preuzmiIzvjestajProvizijePdf } from "../../financeSlice";

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
const fmtDateTime = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString("hr-HR");
};

// Polazak je tekst "DD.MM.YYYY. HH:mm"; new Date() ga ne parsira, pa se za
// redoslijed slaže ručno. Nepoznat oblik ide na kraj.
const uSekunde = (s) => {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*(\d{1,2}):(\d{2})/.exec(String(s || ""));
    if (!m) return Number.MAX_SAFE_INTEGER;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
};

const grupiraj = (niz, kljuc) => {
    const out = new Map();
    for (const x of niz) {
        const k = kljuc(x);
        if (!out.has(k)) out.set(k, []);
        out.get(k).push(x);
    }
    return out;
};
const iznosi = (arr) => ({
    gross: arr.reduce((z, x) => z + (Number(x.gross) || 0), 0),
    base: arr.reduce((z, x) => z + (Number(x.base) || 0), 0),
    commission: arr.reduce((z, x) => z + (Number(x.commission) || 0), 0),
});

// Razrada iza izvještaja — isto što i kod računa, samo s druge strane: ovdje su
// naši ljudi na partnerskom mjestu, pa analitika ide po operateru.
export default function CommissionReportDetailsDrawer({ partner, from, to, redci = [], onClose }) {
    if (!partner) return null;

    const polasci = [...grupiraj(redci, (r) => r.route_uuid || `${r.departure_planed}|${r.line_name}`).values()]
        .map((arr) => ({
            kljuc: arr[0].route_uuid || `${arr[0].departure_planed}|${arr[0].line_name}`,
            departure: arr[0].departure_planed,
            line: arr[0].line_name || "",
            relation: [arr[0].departure_harbor_name, arr[0].arrival_harbor_name].filter(Boolean).join(" → "),
            count: arr.length,
            ...iznosi(arr),
        }))
        .sort((a, b) => uSekunde(a.departure) - uSekunde(b.departure));

    const operateri = [...grupiraj(redci, (r) => `${r.business_premise_name}|${r.billing_device}|${r.operator}`).values()]
        .map((arr) => {
            const vremena = arr.map((x) => (x.sold_at ? new Date(x.sold_at).getTime() : null)).filter((v) => v != null);
            return {
                kljuc: `${arr[0].business_premise_name}|${arr[0].billing_device}|${arr[0].operator}`,
                business_premise_name: arr[0].business_premise_name,
                billing_device: arr[0].billing_device,
                operator: arr[0].operator,
                count: arr.length,
                prva: vremena.length ? new Date(Math.min(...vremena)).toISOString() : null,
                zadnja: vremena.length ? new Date(Math.max(...vremena)).toISOString() : null,
                ...iznosi(arr),
            };
        })
        .sort((a, b) => b.gross - a.gross);

    const zbroj = (redci2, k) => redci2.reduce((z, r) => z + r[k], 0);

    return (
        <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={800}>
                        Detalji izvještaja · {partner.partner_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {redci.length} karata · provizija {Number(partner.commission_pct).toFixed(2)} %
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() => preuzmiIzvjestajProvizijePdf(
                            { partner_uuid: partner.partner_uuid, from, to },
                            { detalji: true }
                        )}
                    >
                        PDF
                    </Button>
                    <Button onClick={onClose} startIcon={<CloseIcon />}>Zatvori</Button>
                </Stack>
            </Stack>

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
                            <TableCell align="right">Promet</TableCell>
                            <TableCell align="right">Osnovica</TableCell>
                            <TableCell align="right">Provizija</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {polasci.map((r) => (
                            <TableRow key={r.kljuc} hover>
                                <TableCell>{r.departure || "—"}</TableCell>
                                <TableCell>{r.line}</TableCell>
                                <TableCell>{r.relation}</TableCell>
                                <TableCell align="right">{r.count}</TableCell>
                                <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.base)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                            </TableRow>
                        ))}
                        {polasci.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Typography variant="body2" color="text.secondary">Nema prodaje</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {polasci.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={3} sx={{ fontWeight: 800 }}>
                                    Ukupno ({polasci.length} {polasci.length === 1 ? "polazak" : "polazaka"})
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{zbroj(polasci, "count")}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj(polasci, "gross"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj(polasci, "base"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj(polasci, "commission"))}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
                Analitika po operateru
            </Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Prodajno mjesto</TableCell>
                            <TableCell>Uređaj</TableCell>
                            <TableCell>Operater</TableCell>
                            <TableCell align="right">Karte</TableCell>
                            <TableCell>Prva prodaja</TableCell>
                            <TableCell>Zadnja prodaja</TableCell>
                            <TableCell align="right">Promet</TableCell>
                            <TableCell align="right">Osnovica</TableCell>
                            <TableCell align="right">Provizija</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {operateri.map((r) => (
                            <TableRow key={r.kljuc} hover>
                                <TableCell>{r.business_premise_name || "—"}</TableCell>
                                <TableCell>{r.billing_device || "—"}</TableCell>
                                <TableCell>{r.operator || "—"}</TableCell>
                                <TableCell align="right">{r.count}</TableCell>
                                <TableCell>{fmtDateTime(r.prva)}</TableCell>
                                <TableCell>{fmtDateTime(r.zadnja)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.base)}</TableCell>
                                <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                            </TableRow>
                        ))}
                        {operateri.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} align="center">
                                    <Typography variant="body2" color="text.secondary">Nema prodaje</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {operateri.length > 0 && (
                            <TableRow>
                                <TableCell colSpan={3} sx={{ fontWeight: 800 }}>Ukupno</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{zbroj(operateri, "count")}</TableCell>
                                <TableCell colSpan={2} />
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj(operateri, "gross"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj(operateri, "base"))}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(zbroj(operateri, "commission"))}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
