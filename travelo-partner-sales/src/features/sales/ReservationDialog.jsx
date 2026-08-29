import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
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
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { clearLastOrder, createOrder, fetchPrices } from './salesSlice'
import { backendURL } from '../../config/config'

const fmtPrice = (n) => `${Number(n).toFixed(2)} €`

export default function ReservationDialog({ open, route, onClose }) {
  const dispatch = useDispatch()
  const { prices, orderSubmitting, lastOrder, orderError } = useSelector((s) => s.sales)
  const { partner, user } = useSelector((s) => s.auth)

  const [qty, setQty] = useState({})
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open && !prices.length) dispatch(fetchPrices())
  }, [open, prices.length, dispatch])

  useEffect(() => {
    if (!open) {
      setQty({})
      setCustomerName('')
      setCustomerEmail('')
      setCustomerPhone('')
      setNote('')
      dispatch(clearLastOrder())
    }
  }, [open, dispatch])

  const routePrices = useMemo(() => {
    if (!route) return []
    return prices.filter(
      (p) =>
        p.is_active &&
        p.timetable_uuid === route.timetable_uuid &&
        p.harbor_from_code === route.departure_harbor_id &&
        p.harbor_to_code === route.arrival_harbor_id
    )
  }, [prices, route])

  const total = useMemo(() => {
    return routePrices.reduce((sum, p) => {
      const q = qty[p.ticket_type_uuid] || 0
      return sum + q * (parseFloat(p.price) || 0)
    }, 0)
  }, [routePrices, qty])

  const totalQty = Object.values(qty).reduce((a, b) => a + (b || 0), 0)

  const bump = (uuid, delta) =>
    setQty((q) => ({ ...q, [uuid]: Math.max(0, (q[uuid] || 0) + delta) }))

  const onSubmit = () => {
    if (!route) return
    dispatch(
      createOrder({
        route_uuid: route.uuid,
        items: routePrices
          .map((p) => ({ ticket_type_uuid: p.ticket_type_uuid, qty: qty[p.ticket_type_uuid] || 0 }))
          .filter((i) => i.qty > 0),
        partner_uuid: partner?.uuid || null,
        // Tko prodaje — obracun provizije razraduje promet po korisniku
        // partnera, pa se korisnicko ime salje uz narudzbu.
        sold_by_username: user?.username || null,
        partner_name: partner?.name || null,
        partner_web_user_uuid: user?.uuid || null,
        partner_web_user_username: user?.username || null,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        note: note || null,
      })
    )
  }

  if (!route) return null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <DirectionsBoatIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              {route.departure_harbor_name} → {route.arrival_harbor_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {route.departure_date} · {route.departure_time} · {route.line_name}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {lastOrder ? (
          <Stack spacing={2}>
            <Alert severity="success">
              Rezervacija kreirana. Broj: <strong>{lastOrder.uuid?.slice(0, 8)}</strong>,
              iznos: <strong>{fmtPrice(lastOrder.total_amount)}</strong>
            </Alert>

            {lastOrder.tickets?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Izdano karata: {lastOrder.tickets.length}
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Broj karte</TableCell>
                        <TableCell>Tip</TableCell>
                        <TableCell align="right">Cijena</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lastOrder.tickets.map((t) => (
                        <TableRow key={t.ticket_uuid}>
                          <TableCell><code>{t.ticket_code}</code></TableCell>
                          <TableCell>{t.ticket_type_name}</TableCell>
                          <TableCell align="right">{fmtPrice(t.single_price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            <Button
              variant="contained"
              size="large"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => window.open(`${backendURL}${lastOrder.tickets_pdf_url}`, '_blank')}
              disabled={!lastOrder.tickets_pdf_url}
              sx={{ alignSelf: 'flex-start', fontWeight: 800 }}
            >
              Otvori karte (PDF)
            </Button>
          </Stack>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Tipovi karata</Typography>
            {!routePrices.length && (
              <Alert severity="warning">
                Nema definiranih cijena za ovu relaciju/raspored. Provjeri u portalu.
              </Alert>
            )}
            {routePrices.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Karta</TableCell>
                      <TableCell align="right">Cijena</TableCell>
                      <TableCell align="center" width={200}>Količina</TableCell>
                      <TableCell align="right">Ukupno</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {routePrices.map((p) => {
                      const q = qty[p.ticket_type_uuid] || 0
                      const line = q * (parseFloat(p.price) || 0)
                      return (
                        <TableRow key={p.uuid}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{p.ticket_type_name}</Typography>
                            {p.ticket_type_name_eng && (
                              <Typography variant="caption" color="text.secondary">
                                {p.ticket_type_name_eng}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{fmtPrice(p.price)}</TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                              <IconButton size="small" onClick={() => bump(p.ticket_type_uuid, -1)} disabled={q === 0}>
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                              <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{q}</Typography>
                              <IconButton size="small" onClick={() => bump(p.ticket_type_uuid, 1)}>
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <strong>{fmtPrice(line)}</strong>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Kupac (opcionalno)</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Ime i prezime" value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth />
              <TextField label="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} fullWidth />
              <TextField label="Telefon" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} fullWidth />
            </Stack>

            <TextField
              label="Napomena (opcionalno)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              sx={{ mt: 2 }}
            />

            {orderError && <Alert severity="error" sx={{ mt: 2 }}>{orderError}</Alert>}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          {!lastOrder && (
            <Typography variant="subtitle1" fontWeight={900}>
              Ukupno: {fmtPrice(total)} · {totalQty} kom
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>{lastOrder ? 'Zatvori' : 'Odustani'}</Button>
          {!lastOrder && (
            <Button
              onClick={onSubmit}
              variant="contained"
              disabled={orderSubmitting || totalQty === 0}
              sx={{ fontWeight: 800 }}
            >
              {orderSubmitting ? 'Rezerviram…' : 'Potvrdi rezervaciju'}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
