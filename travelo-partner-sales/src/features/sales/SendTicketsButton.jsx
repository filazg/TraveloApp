import { useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { api } from '../../app/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Gumb „Pošalji putniku": karte rezervacije e-mailom (PDF u privitku).
// Adresa se predlaže iz rezervacije, ali se može promijeniti.
export default function SendTicketsButton({ orderUuid, defaultEmail = '', size = 'medium', sx }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(defaultEmail)
  const [lang, setLang] = useState('hr')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const otvori = () => {
    setEmail(defaultEmail || '')
    setResult(null)
    setOpen(true)
  }

  const posalji = async () => {
    setSending(true)
    setResult(null)
    try {
      await api.post('/sales/order_tickets/send', { order_uuid: orderUuid, email: email.trim(), lang })
      setResult({ ok: true, text: `Karte su poslane na ${email.trim()}.` })
    } catch (err) {
      const d = err.response?.data
      setResult({ ok: false, text: d?.data?.message || d?.message || 'Slanje nije uspjelo.' })
    } finally {
      setSending(false)
    }
  }

  const ispravan = EMAIL_RE.test(email.trim())

  return (
    <>
      <Button variant="outlined" size={size} startIcon={<SendIcon />} onClick={otvori} disabled={!orderUuid} sx={sx}>
        Pošalji putniku
      </Button>
      <Dialog open={open} onClose={() => !sending && setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Pošalji karte putniku</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="E-mail putnika"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!email && !ispravan}
              helperText={email && !ispravan ? 'Neispravna e-mail adresa' : ' '}
              autoFocus
              fullWidth
            />
            <ToggleButtonGroup size="small" exclusive value={lang} onChange={(_, v) => v && setLang(v)}>
              <ToggleButton value="hr">Hrvatski</ToggleButton>
              <ToggleButton value="en">English</ToggleButton>
            </ToggleButtonGroup>
            {result && <Alert severity={result.ok ? 'success' : 'error'}>{result.text}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={sending}>{result?.ok ? 'Zatvori' : 'Odustani'}</Button>
          <Button
            variant="contained"
            onClick={posalji}
            disabled={!ispravan || sending}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          >
            Pošalji
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
