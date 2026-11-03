import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Alert,
  Autocomplete,
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
  TextField,
  Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import SearchIcon from '@mui/icons-material/Search'
import dayjs from 'dayjs'
import { fetchHarbors, fetchRoutes } from '../features/sales/salesSlice'
import ReservationDialog from '../features/sales/ReservationDialog'
import { isSaleOpen, SALE_CUTOFF_MINUTES } from '../features/sales/departureCutoff'

// Luka se traži tipkanjem: popis se sužava dok se piše (bez obzira na kvačice
// i velika slova), bez otvaranja padajućeg izbornika. Prazno polje = sve luke.
function LukaPolje({ label, luke, value, onChange }) {
  return (
    <Autocomplete
      options={luke}
      value={luke.find((h) => h.code === value) || null}
      onChange={(_, h) => onChange(h?.code || '')}
      getOptionLabel={(h) => h?.name || ''}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      renderOption={(props, h) => <li {...props} key={h.uuid}>{h.name}</li>}
      autoHighlight
      noOptionsText="Nema luke"
      sx={{ minWidth: 260, flex: 1 }}
      renderInput={(params) => <TextField {...params} label={label} placeholder="— sve —" />}
    />
  )
}

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
  const [kalendar, setKalendar] = useState(false)
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
    // Samo aktivne luke; neaktivne se u portalu isključuju iz prodaje.
    () => (harbors || []).filter((h) => h?.is_active !== false).sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), 'hr', { sensitivity: 'base' })
    ),
    [harbors]
  )

  return (
    // Puna sirina kao i prikazi u portalu: rezultati pretrage su tablica i na
    // uskom stupcu se lome, a ekran je ionako prazan sa strane.
    <Box sx={{ width: '98%', mx: 'auto' }}>
      <Typography variant="h5" fontWeight={900} sx={{ mb: 2 }}>
        Pretraga polazaka
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }} component="form" onSubmit={onSearch}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <LukaPolje label="Od (polazna luka)" luke={lukeAbecedno} value={fromCode} onChange={setFromCode} />
          <LukaPolje label="Do (dolazna luka)" luke={lukeAbecedno} value={toCode} onChange={setToCode} />
          <DatePicker
            label="Datum"
            value={date}
            onChange={(v) => setDate(v)}
            format="DD/MM/YYYY"
            // Klik bilo gdje u polju otvara kalendar, ne samo ikona.
            open={kalendar}
            onOpen={() => setKalendar(true)}
            onClose={() => setKalendar(false)}
            slotProps={{ textField: { sx: { minWidth: 200 }, onClick: () => setKalendar(true) } }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<SearchIcon />}
            disabled={loading}
            sx={{ fontWeight: 900, height: 56, px: 4 }}
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
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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
