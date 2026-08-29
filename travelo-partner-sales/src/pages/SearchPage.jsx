import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
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
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import SearchIcon from '@mui/icons-material/Search'
import dayjs from 'dayjs'
import { fetchHarbors, fetchRoutes } from '../features/sales/salesSlice'
import ReservationDialog from '../features/sales/ReservationDialog'
import { isSaleOpen, SALE_CUTOFF_MINUTES } from '../features/sales/departureCutoff'

// Pomaknut polazak: vozni red ostaje u departure, stvarno vrijeme je u
// actual_departure. Partner prodaje po stvarnom vremenu, pa se ono prikazuje.
const samoVrijeme = (v) => {
  const m = /(\d{1,2}):(\d{2})/.exec(String(v || ''))
  return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : ''
}
const jePomaknut = (r) => !!(r?.departure && r?.actual_departure && r.departure !== r.actual_departure)
const vrijemePolaska = (r) => (jePomaknut(r) ? samoVrijeme(r.actual_departure) : (r?.departure_time || ''))


export default function SearchPage() {
  const dispatch = useDispatch()
  const { harbors, routes, loading, error } = useSelector((s) => s.sales)
  const [fromCode, setFromCode] = useState('')
  const [toCode, setToCode] = useState('')
  const [date, setDate] = useState(dayjs())
  const [submitted, setSubmitted] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState(null)

  useEffect(() => {
    if (!harbors.length) dispatch(fetchHarbors())
    if (!routes.length) dispatch(fetchRoutes())
  }, [dispatch, harbors.length, routes.length])

  const results = useMemo(() => {
    if (!submitted) return []
    const dateStr = date?.isValid?.() ? date.format('DD/MM/YYYY') : ''
    return routes
      .filter((r) => r.is_active && r.is_actual)
      .filter((r) => !fromCode || r.departure_harbor_id === fromCode)
      .filter((r) => !toCode || r.arrival_harbor_id === toCode)
      .filter((r) => !dateStr || r.departure_date === dateStr)
      // Polasci koji su krenuli (ili im je do polaska manje od cutoffa) ne idu u
      // prodaju — vidi features/sales/departureCutoff.js.
      .filter((r) => isSaleOpen(r))
      .sort((a, b) => (vrijemePolaska(a) > vrijemePolaska(b) ? 1 : -1))
  }, [routes, fromCode, toCode, date, submitted])

  const onSearch = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  // Luke abecedno, kao i na web prodaji. Poslužitelj ih vraća redoslijedom iz
  // voznog reda, pa se svoja luka tražila po popisu. Hrvatska pravila
  // usporedbe, da č, ć, š, ž ne odu iza z.
  const lukeAbecedno = useMemo(
    () => [...(harbors || [])].sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), 'hr', { sensitivity: 'base' })
    ),
    [harbors]
  )

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        Pretraga polazaka
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }} component="form" onSubmit={onSearch}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            select
            label="Od (polazna luka)"
            value={fromCode}
            onChange={(e) => setFromCode(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">— sve —</MenuItem>
            {lukeAbecedno.map((h) => (
              <MenuItem key={h.uuid} value={h.code}>
                {h.name} ({h.code})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Do (dolazna luka)"
            value={toCode}
            onChange={(e) => setToCode(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">— sve —</MenuItem>
            {lukeAbecedno.map((h) => (
              <MenuItem key={h.uuid} value={h.code}>
                {h.name} ({h.code})
              </MenuItem>
            ))}
          </TextField>
          <DatePicker
            label="Datum"
            value={date}
            onChange={(v) => setDate(v)}
            format="DD/MM/YYYY"
            slotProps={{ textField: { sx: { minWidth: 180 } } }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<SearchIcon />}
            disabled={loading}
            sx={{ fontWeight: 900 }}
          >
            Pretraži
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <ReservationDialog
        open={!!selectedRoute}
        route={selectedRoute}
        onClose={() => setSelectedRoute(null)}
      />

      {submitted && (
        <Paper variant="outlined">
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Rezultati: {results.length}
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Datum</TableCell>
                  <TableCell>Polazak</TableCell>
                  <TableCell>Dolazak</TableCell>
                  <TableCell>Od</TableCell>
                  <TableCell>Do</TableCell>
                  <TableCell>Linija</TableCell>
                  <TableCell>Raspored</TableCell>
                  <TableCell align="right">Akcija</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.uuid} hover>
                    <TableCell>{r.departure_date}</TableCell>
                    <TableCell>
                      <strong>{vrijemePolaska(r)}</strong>
                      {jePomaknut(r) && (
                        <Chip size="small" color="warning" sx={{ ml: 1, height: 18, fontSize: 10, fontWeight: 700 }}
                              label={'pomaknut, po redu ' + r.departure_time} />
                      )}
                    </TableCell>
                    <TableCell>{r.actual_arrival?.split(' ')[1] || ''}</TableCell>
                    <TableCell>{r.departure_harbor_name}</TableCell>
                    <TableCell>{r.arrival_harbor_name}</TableCell>
                    <TableCell><Chip size="small" label={r.line_name} /></TableCell>
                    <TableCell>{r.timetable_name}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => setSelectedRoute(r)}
                      >
                        Rezerviraj
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!results.length && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nema polazaka za odabrane kriterije. Prodaja se zatvara{' '}
                      {SALE_CUTOFF_MINUTES} min prije polaska, pa se polasci koji su
                      krenuli više ne prikazuju.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  )
}
