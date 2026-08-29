import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { fetchCommission, preuzmiIzvjestajPdf } from '../features/finance/financeSlice'

const fmtEUR = (n) => `${Number(n || 0).toFixed(2)} €`
const hrDatum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}.` : String(iso || '')
}

// Jedna kartica po razdoblju, a unutar nje dvije razrade, jer promet dolazi iz
// dva izvora i ne obračunava se isto:
//
//  1. za naš račun — karte prodane u ime prijevoznika, na partnerovom prodajnom
//     mjestu. Novac je njegov, partneru pripada provizija.
//  2. za vlastiti račun — karte prodane kroz partnersku prodaju. Njih partner
//     naplaćuje sam, a provizija mu se odbija na zbirnom računu.
function Kartica({ naslov, oznaka, oznakaBoja, podaci, istaknuto }) {
  const partner = (podaci?.partners || [])[0] || null
  const kanal = podaci?.partner_channel || null
  if (!partner && !kanal) return null

  return (
    <Paper variant="outlined" sx={{ mb: 2, ...(istaknuto ? { borderColor: 'warning.main' } : null) }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 800, flex: 1 }}>
          {naslov}
          {podaci?.from && podaci?.to ? ` · ${hrDatum(podaci.from)} – ${hrDatum(podaci.to)}` : ''}
        </Typography>
        {oznaka ? <Chip size="small" color={oznakaBoja} label={oznaka} /> : null}
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          onClick={() => preuzmiIzvjestajPdf({ from: podaci.from, to: podaci.to }, false)}
        >
          Izvještaj PDF
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          onClick={() => preuzmiIzvjestajPdf({ from: podaci.from, to: podaci.to }, true)}
        >
          Detalji PDF
        </Button>
      </Stack>

      {partner ? (
        <Box>
          <Typography sx={{ px: 2, pt: 2, pb: 1, fontWeight: 700 }}>
            Prodaja u ime prijevoznika{podaci?.company_name ? ` · ${podaci.company_name}` : ''}
          </Typography>
          <TableContainer sx={{ overflowX: 'auto' }}>
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
        </Box>
      ) : null}

      {kanal ? (
        <Box sx={{ mt: partner ? 2 : 0 }}>
          <Typography sx={{ px: 2, pt: 2, pb: 1, fontWeight: 700 }}>
            Prodaja za vlastiti račun
          </Typography>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Korisnik</TableCell>
                  <TableCell align="right">Karata</TableCell>
                  <TableCell align="right">Promet</TableCell>
                  <TableCell align="right">Osnovica</TableCell>
                  <TableCell align="right">Provizija</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(kanal.rows || []).map((r) => (
                  <TableRow key={r.username}>
                    <TableCell>{r.username}</TableCell>
                    <TableCell align="right">{r.tickets}</TableCell>
                    <TableCell align="right">{fmtEUR(r.gross)}</TableCell>
                    <TableCell align="right">{fmtEUR(r.base)}</TableCell>
                    <TableCell align="right">{fmtEUR(r.commission)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Ukupno za vlastiti račun</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{kanal.tickets}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(kanal.gross)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{fmtEUR(kanal.base)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>{fmtEUR(kanal.commission)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : null}
    </Paper>
  )
}

// Obračun provizije — partner vidi samo svoj, pa nema ni odabira partnera ni
// tražilice: razdoblje proizlazi iz dogovorene dinamike naplate.
export default function CommissionPage() {
  const dispatch = useDispatch()
  const { commission, commissionOpen, commissionLoading, error } = useSelector((s) => s.finance)

  useEffect(() => {
    dispatch(fetchCommission({}))
    dispatch(fetchCommission({ period: 'current' }))
  }, [dispatch])

  const nemaNista = !commission?.partners?.length && !commission?.partner_channel
    && !commissionOpen?.partners?.length && !commissionOpen?.partner_channel

  return (
    <Box sx={{ width: '98%', mx: 'auto' }}>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        Obračun provizije
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Kartica naslov="Obračun" oznaka="za isplatu" oznakaBoja="primary" podaci={commission} />
      <Kartica naslov="Otvoreno razdoblje" oznaka="u tijeku — nije za isplatu" oznakaBoja="warning" podaci={commissionOpen} istaknuto />

      {!commissionLoading && nemaNista && (
        <Alert severity="info">U obračunskom razdoblju nema prodaje.</Alert>
      )}
    </Box>
  )
}
