import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import {
  clearInvoice,
  fetchCommission,
  fetchInvoice,
  fetchInvoices,
  preuzmiIzvjestajPdf,
  preuzmiRacunPdf,
} from '../features/finance/financeSlice'

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`
const fmtDatum = (s) => {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('hr-HR')
}
const hrDatum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(iso || '')
}

const GODINE = (() => {
  const g = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => g + 1 - i)
})()
const MJESECI = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac']

// Računi koje nam prijevoznik izdaje za karte prodane za naš račun: novac je
// sjeo kod nas, pa nam se fakturira prodano umanjeno za proviziju.
function TabRacuni() {
  const dispatch = useDispatch()
  const { invoices, invoicesLoading, invoice, error } = useSelector((s) => s.finance)
  const [godina, setGodina] = useState(new Date().getFullYear())
  const [mjesec, setMjesec] = useState('')

  const trazi = () => dispatch(fetchInvoices({ year: godina, month: mjesec || undefined }))

  useEffect(() => {
    trazi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const racun = invoice?.invoice
  const jeF2 = racun ? (racun.is_f2 != null ? !!racun.is_f2 : !!racun.fiskal_required) : false
  const oznaka = racun?.partner_invoice_code || (racun ? `${racun.partner_invoice_no}/${racun.invoice_year}` : '')

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ my: 2, flexWrap: 'wrap' }} alignItems="center">
        <TextField select label="Godina" value={godina} onChange={(e) => setGodina(Number(e.target.value))} sx={{ width: 120 }}>
          {GODINE.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
        </TextField>
        <TextField select label="Mjesec" value={mjesec} onChange={(e) => setMjesec(e.target.value)} sx={{ width: 200 }}>
          <MenuItem value="">— svi —</MenuItem>
          {MJESECI.map((m, i) => <MenuItem key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')} — {m}</MenuItem>)}
        </TextField>
        <Button variant="contained" size="large" startIcon={<SearchIcon />} onClick={trazi} disabled={invoicesLoading} sx={{ height: 56, px: 3 }}>
          Pretraži
        </Button>
        <Chip label={`${invoices.length} računa`} />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Datum</TableCell>
                <TableCell>Oznaka</TableCell>
                <TableCell>Razdoblje</TableCell>
                <TableCell align="right">Karata</TableCell>
                <TableCell align="right">Promet</TableCell>
                <TableCell align="right">Provizija</TableCell>
                <TableCell align="right">Za plaćanje</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((r) => (
                <TableRow
                  key={r.partner_invoice_uuid}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => dispatch(fetchInvoice(r.partner_invoice_uuid))}
                >
                  <TableCell>{fmtDatum(r.invoice_date)}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{r.partner_invoice_code || `${r.partner_invoice_no}/${r.invoice_year}`}</TableCell>
                  <TableCell>{fmtDatum(r.period_from)} – {fmtDatum(r.period_to)}</TableCell>
                  <TableCell align="right">{r.tickets_count}</TableCell>
                  <TableCell align="right">{fmtEUR(r.gross_amount)}</TableCell>
                  <TableCell align="right">{fmtEUR(r.commission_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtEUR(r.net_amount)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={r.status === 'paid' ? 'success' : 'default'} label={r.status === 'paid' ? 'Plaćeno' : 'Izdano'} />
                  </TableCell>
                </TableRow>
              ))}
              {!invoices.length && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {invoicesLoading ? 'Učitavanje…' : 'Nema računa u odabranom razdoblju.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={!!racun} onClose={() => dispatch(clearInvoice())} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={800}>
                {jeF2 ? 'F2 Račun' : 'Račun'} {oznaka}
              </Typography>
              {jeF2 ? <Chip size="small" color="secondary" label="F2" /> : null}
            </Stack>
            <Button onClick={() => dispatch(clearInvoice())} startIcon={<CloseIcon />}>Zatvori</Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {racun && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Izdavatelj: {racun.company_name} · razdoblje {fmtDatum(racun.period_from)} – {fmtDatum(racun.period_to)} ·{' '}
                {racun.tickets_count} karata
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow><TableCell>Naplaćeno (bruto)</TableCell><TableCell align="right">{fmtEUR(racun.gross_amount)}</TableCell></TableRow>
                  <TableRow><TableCell>Osnovica</TableCell><TableCell align="right">{fmtEUR(racun.commission_base)}</TableCell></TableRow>
                  <TableRow><TableCell>Provizija ({Number(racun.commission_pct || 0).toFixed(2)} %)</TableCell><TableCell align="right">− {fmtEUR(racun.commission_amount)}</TableCell></TableRow>
                  <TableRow><TableCell>Osnovica za PDV</TableCell><TableCell align="right">{fmtEUR(racun.vat_base)}</TableCell></TableRow>
                  <TableRow><TableCell>PDV ({Number(racun.vat_rate || 0).toFixed(0)} %)</TableCell><TableCell align="right">{fmtEUR(racun.vat_amount)}</TableCell></TableRow>
                  <TableRow><TableCell>Lučka pristojba (bez PDV-a)</TableCell><TableCell align="right">{fmtEUR(racun.harbor_tax_amount)}</TableCell></TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Za plaćanje</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900 }}>{fmtEUR(racun.net_amount)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
                <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => preuzmiRacunPdf(racun.partner_invoice_uuid, false)}>
                  Račun PDF
                </Button>
                <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={() => preuzmiRacunPdf(racun.partner_invoice_uuid, true)}>
                  Detalji PDF
                </Button>
              </Stack>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}

// Izvještaj za proviziju — podloga po kojoj partner ispostavlja svoj račun.
function TabIzvjestaji() {
  const dispatch = useDispatch()
  const { commission, commissionLoading } = useSelector((s) => s.finance)

  useEffect(() => {
    if (!commission) dispatch(fetchCommission({}))
  }, [dispatch, commission])

  const partner = (commission?.partners || [])[0] || null

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
        Izvještaj obuhvaća prodaju u ime prijevoznika i podloga je za račun provizije. Razdoblje
        proizlazi iz dogovorene dinamike naplate.
      </Typography>

      {!partner && !commissionLoading && (
        <Alert severity="info">U obračunskom razdoblju nema prodaje u ime prijevoznika.</Alert>
      )}

      {partner && (
        <Paper variant="outlined">
          <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 800, flex: 1 }}>
              Razdoblje {hrDatum(commission.from)} – {hrDatum(commission.to)}
            </Typography>
            <Chip size="small" color="primary" label={`${Number(partner.commission_pct).toFixed(2)} %`} />
            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => preuzmiIzvjestajPdf({ from: commission.from, to: commission.to }, false)}
            >
              Izvještaj PDF
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => preuzmiIzvjestajPdf({ from: commission.from, to: commission.to }, true)}
            >
              Detalji PDF
            </Button>
          </Stack>
          <TableContainer>
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
                    <TableRow key={`${m.business_premise_uuid}-${r.billing_device}-${r.operator}`}>
                      <TableCell>{i === 0 ? m.business_premise_name : ''}</TableCell>
                      <TableCell>{r.billing_device || '—'}</TableCell>
                      <TableCell>{r.operator || '—'}</TableCell>
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
        </Paper>
      )}
    </Box>
  )
}

// Novac ide u dva smjera i ne miješa se: račun nam izdaje prijevoznik za karte
// koje smo prodali za svoj račun, a izvještaj je podloga za našu proviziju.
export default function FinancePage() {
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ width: '98%', mx: 'auto' }}>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        Računi i izvještaji
      </Typography>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Računi za prodaju" />
        <Tab label="Izvještaji za provizije" />
      </Tabs>
      {tab === 0 ? <TabRacuni /> : <TabIzvjestaji />}
    </Box>
  )
}
