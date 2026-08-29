import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
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
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import dayjs from 'dayjs'
import { fetchOrderTickets, fetchReservations } from '../features/sales/salesSlice'

const fmtPrice = (n) => `${Number(n || 0).toFixed(2)} €`
const fmtDateTime = (s) => {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(s) : d.toLocaleString('hr-HR')
}

const STATUSI = {
  confirmed: { label: 'Potvrđeno', color: 'success' },
  created: { label: 'Kreirano', color: 'default' },
  pending_payment: { label: 'Čeka plaćanje', color: 'warning' },
  canceled: { label: 'Otkazano', color: 'error' },
}

// Koliko je karata u rezervaciji — stavke nose količinu po vrsti karte.
const brojKarata = (order) =>
  (Array.isArray(order.items) ? order.items : []).reduce((z, s) => z + (parseInt(s.qty, 10) || 0), 0)
const sastav = (order) =>
  (Array.isArray(order.items) ? order.items : [])
    .map((s) => `${s.qty} × ${s.ticket_type_name}`)
    .join(' · ')

// Moje rezervacije — što je ovaj partner prodao.
//
// Razdoblje se mjeri po trenutku rezervacije, ne po polasku: partner traži "što
// sam prodao u kolovozu", a polazak zna biti mjesecima poslije.
export default function ReservationsPage() {
  const dispatch = useDispatch()
  const { partner } = useSelector((s) => s.auth)
  const { reservations, reservationsLoading, reservationsError, orderTickets, orderTicketsLoading } =
    useSelector((s) => s.sales)

  const [od, setOd] = useState(dayjs().startOf('month'))
  const [doo, setDoo] = useState(dayjs())
  const [trazilica, setTrazilica] = useState('')
  const [otvorena, setOtvorena] = useState(null)

  const trazi = () => {
    dispatch(fetchReservations({
      partner_uuid: partner?.uuid,
      from: od ? od.format('YYYY-MM-DD') : undefined,
      to: doo ? doo.format('YYYY-MM-DD') : undefined,
      limit: 500,
    }))
  }

  useEffect(() => {
    trazi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.uuid])

  // Pretraga po tekstu ide lokalno: popis je već dohvaćen, a partner traži po
  // napomeni ili broju rezervacije koje pamti iz razgovora s kupcem.
  const prikazani = useMemo(() => {
    const q = trazilica.trim().toLowerCase()
    if (!q) return reservations
    return reservations.filter((o) =>
      [`PW-${o.id}`, o.note, o.customer_name, o.customer_email, o.line_name,
        o.departure_harbor_name, o.arrival_harbor_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [reservations, trazilica])

  const otvori = (order) => {
    setOtvorena(order)
    dispatch(fetchOrderTickets({ order_uuid: order.uuid, partner_uuid: partner?.uuid }))
  }

  const ukupno = prikazani.reduce((z, o) => z + (Number(o.total_amount) || 0), 0)

  return (
    <Box sx={{ width: '98%', mx: 'auto' }}>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        Moje rezervacije
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <DatePicker
            label="Od"
            value={od}
            onChange={setOd}
            format="DD/MM/YYYY"
            slotProps={{ textField: { sx: { minWidth: 180 } } }}
          />
          <DatePicker
            label="Do"
            value={doo}
            onChange={setDoo}
            format="DD/MM/YYYY"
            slotProps={{ textField: { sx: { minWidth: 180 } } }}
          />
          <TextField
            label="Pretraži (broj, napomena, kupac, linija)"
            value={trazilica}
            onChange={(e) => setTrazilica(e.target.value)}
            sx={{ minWidth: 320, flex: 1 }}
          />
          <Button
            variant="contained"
            size="large"
            startIcon={<SearchIcon />}
            onClick={trazi}
            disabled={reservationsLoading}
            sx={{ fontWeight: 900, height: 56, px: 4 }}
          >
            Pretraži
          </Button>
          <Chip label={`${prikazani.length} rezervacija`} />
          <Chip color="primary" label={`Ukupno: ${fmtPrice(ukupno)}`} />
        </Stack>
      </Paper>

      {reservationsError && <Alert severity="error" sx={{ mb: 2 }}>{reservationsError}</Alert>}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rezervacija</TableCell>
                <TableCell>Rezervirano</TableCell>
                <TableCell>Polazak</TableCell>
                <TableCell>Relacija</TableCell>
                <TableCell>Karte</TableCell>
                <TableCell>Napomena</TableCell>
                <TableCell align="right">Iznos</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prikazani.map((o) => {
                const status = STATUSI[o.status] || { label: o.status || '—', color: 'default' }
                return (
                  <TableRow key={o.uuid} hover sx={{ cursor: 'pointer' }} onClick={() => otvori(o)}>
                    <TableCell sx={{ fontWeight: 700 }}>PW-{o.id}</TableCell>
                    <TableCell>{fmtDateTime(o.createdAt)}</TableCell>
                    <TableCell>{o.departure_date} {o.departure_time}</TableCell>
                    <TableCell>
                      {o.departure_harbor_name} → {o.arrival_harbor_name}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {o.line_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {brojKarata(o)}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {sastav(o)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>{o.note}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPrice(o.total_amount)}</TableCell>
                    <TableCell>
                      <Chip size="small" color={status.color} label={status.label} />
                    </TableCell>
                  </TableRow>
                )
              })}
              {!prikazani.length && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {reservationsLoading ? 'Učitavanje…' : 'Nema rezervacija u odabranom razdoblju.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={!!otvorena} onClose={() => setOtvorena(null)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                Rezervacija PW-{otvorena?.id}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {otvorena?.departure_date} · {otvorena?.departure_time} ·{' '}
                {otvorena?.departure_harbor_name} → {otvorena?.arrival_harbor_name}
              </Typography>
            </Box>
            <Button onClick={() => setOtvorena(null)} startIcon={<CloseIcon />}>Zatvori</Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={4} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Rezervirano</Typography>
              <Typography fontWeight={700}>{fmtDateTime(otvorena?.createdAt)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Kupac</Typography>
              <Typography fontWeight={700}>{otvorena?.customer_name || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Iznos</Typography>
              <Typography fontWeight={700}>{fmtPrice(otvorena?.total_amount)}</Typography>
            </Box>
          </Stack>

          {otvorena?.note && (
            <Box sx={{ mb: 2, bgcolor: '#fff8e1', border: '1px solid #ffe082', borderRadius: 1, p: 1.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>
                Napomena
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{otvorena.note}</Typography>
            </Box>
          )}

          {orderTicketsLoading ? (
            <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={22} /></Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Oznaka karte</TableCell>
                    <TableCell>Vrsta</TableCell>
                    <TableCell align="right">Cijena</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderTickets.map((k) => (
                    <TableRow key={k.ticket_uuid}>
                      <TableCell><code>{k.ticket_code}</code></TableCell>
                      <TableCell>{k.ticket_type_name}</TableCell>
                      <TableCell align="right">{fmtPrice(k.single_price)}</TableCell>
                    </TableRow>
                  ))}
                  {!orderTickets.length && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Nema karata uz ovu rezervaciju.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
