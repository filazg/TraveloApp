import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { login } from '../features/auth/authSlice'
import BrandMark from '../layout/BrandMark'

export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error, user } = useSelector((s) => s.auth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    dispatch(login({ username, password }))
  }

  useEffect(() => {
    if (user?.username) {
      navigate('/search', { replace: true })
    }
  }, [user, navigate])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Grid
        container
        sx={{
          width: '100%',
          maxWidth: 1200,
          minHeight: 560,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(15,23,42,0.18)',
        }}
      >
        {/* LEFT – ZNAK */}
        {/* Ista ploca kao na prijavi u portal: puna brand plava i tekstualni
            znak, umjesto slike s ukosenim natpisom. Tako logo stoji na jednom
            mjestu i prati font aplikacije. */}
        <Grid
          size={{ xs: 0, md: 7 }}
          sx={{
            display: { xs: 'none', md: 'flex' },
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.main',
          }}
        >
          <BrandMark
            variant="h1"
            onPrimary
            sx={{
              textAlign: 'center',
              px: 4,
              fontSize: { md: 64, lg: 88 },
              whiteSpace: 'nowrap',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'white',
              fontSize: 12,
              opacity: 0.9,
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            © 2026 Tech4beez
          </Box>
        </Grid>

        {/* RIGHT – LOGIN FORM */}
        <Grid
          size={{ xs: 12, md: 5 }}
          component={Paper}
          elevation={0}
          square
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 3, sm: 4 },
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 460 }}>
            <Stack spacing={1} sx={{ mb: 3 }}>
              <Typography variant="h5" fontWeight={900}>
                Prijava
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <BrandMark /> - partnerska prodaja. Unesi svoje pristupne podatke.
              </Typography>
            </Stack>
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="Korisničko ime"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  fullWidth
                />

                <TextField
                  label="Lozinka"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton edge="end" onClick={() => setShowPass((s) => !s)}>
                          {showPass ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {error && <Alert severity="error">{error}</Alert>}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ fontWeight: 900 }}
                >
                  {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <span>Prijava…</span>
                    </Stack>
                  ) : (
                    'Prijavi se'
                  )}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
