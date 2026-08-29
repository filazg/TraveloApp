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

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`;
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
                <Button onClick={onClose} startIcon={<CloseIcon />}>Zatvori</Button>
            </Stack>

            <RouteSummarySection items={items} />
            <Box sx={{ my: 3 }} />
            <OrderBreakdownSection items={items} />
        </Box>
    );
}

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
        return { route_uuid, line, relation, count, gross, commission, net };
    });

    return (
        <>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Agregat po relaciji
            </Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
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
                            <TableRow key={r.route_uuid}>
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
                                <TableCell colSpan={6} align="center">
                                    <Typography variant="body2" color="text.secondary">Nema stavki</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
}

function OrderBreakdownSection({ items }) {
    const groups = groupBy(items, (it) => it.order_uuid || `ticket:${it.ticket_uuid}`);
    const orders = Object.entries(groups)
        .map(([order_uuid, arr]) => {
            const note = arr.find((x) => x.order_note)?.order_note || null;
            const times = arr.map((x) => (x.sale_datetime ? new Date(x.sale_datetime).getTime() : null)).filter((t) => t != null);
            const saleTime = times.length ? new Date(Math.min(...times)).toISOString() : null;
            const count = arr.length;
            const gross = arr.reduce((s, x) => s + Number(x.gross_amount || 0), 0);
            const commission = arr.reduce((s, x) => s + Number(x.commission_amount || 0), 0);
            const net = arr.reduce((s, x) => s + Number(x.net_amount || 0), 0);
            return { order_uuid, note, saleTime, count, gross, commission, net, items: arr };
        })
        .sort((a, b) => (a.saleTime || "").localeCompare(b.saleTime || ""));

    return (
        <>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Rezime po kupnji
            </Typography>
            <Stack spacing={2}>
                {orders.map((o) => (
                    <Box key={o.order_uuid} sx={{ border: "1px solid #e0e0e0", borderRadius: 1, p: 2 }}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={1}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Vrijeme kupnje</Typography>
                                <Typography fontWeight={700}>{fmtDateTime(o.saleTime)}</Typography>
                            </Box>
                            <Stack direction="row" spacing={3}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Karte</Typography>
                                    <Typography fontWeight={700}>{o.count}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Bruto</Typography>
                                    <Typography fontWeight={700}>{fmtEUR(o.gross)}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Provizija</Typography>
                                    <Typography fontWeight={700}>{fmtEUR(o.commission)}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Osnovica za PDV</Typography>
                                    <Typography fontWeight={700} color="primary">{fmtEUR(o.net)}</Typography>
                                </Box>
                            </Stack>
                        </Stack>
                        {o.note && (
                            <Box sx={{ mt: 1.5, bgcolor: "#fff8e1", border: "1px solid #ffe082", borderRadius: 1, p: 1.25 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 700 }}>Napomena</Typography>
                                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{o.note}</Typography>
                            </Box>
                        )}
                        <Box sx={{ mt: 1.5 }}>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Karta</TableCell>
                                            <TableCell>Tip</TableCell>
                                            <TableCell>Linija</TableCell>
                                            <TableCell>Relacija</TableCell>
                                            <TableCell>Polazak</TableCell>
                                            <TableCell align="right">Bruto</TableCell>
                                            <TableCell align="right">Provizija</TableCell>
                                            <TableCell align="right">Osnovica za PDV</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {o.items.map((it) => (
                                            <TableRow key={it.id}>
                                                <TableCell>{it.ticket_code}</TableCell>
                                                <TableCell>{it.ticket_type_name}</TableCell>
                                                <TableCell>{it.line_code || it.line_name}</TableCell>
                                                <TableCell>
                                                    {[it.departure_harbor_name, it.arrival_harbor_name].filter(Boolean).join(" → ")}
                                                </TableCell>
                                                <TableCell>{it.departure}</TableCell>
                                                <TableCell align="right">{fmtEUR(it.gross_amount)}</TableCell>
                                                <TableCell align="right">{fmtEUR(it.commission_amount)}</TableCell>
                                                <TableCell align="right">{fmtEUR(it.net_amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Box>
                ))}
                {orders.length === 0 && (
                    <Typography variant="body2" color="text.secondary" align="center">Nema stavki</Typography>
                )}
            </Stack>
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
