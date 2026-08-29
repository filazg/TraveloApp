import { useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logoutRemote } from '../features/auth/authSlice'
import BrandMark from './BrandMark'

const NAV_ITEMS = [
  { path: '/search', label: 'Prodaja', icon: <SearchIcon fontSize="small" /> },
  { path: '/reservations', label: 'Moje rezervacije', icon: <ReceiptLongIcon fontSize="small" /> },
]

export default function AppLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, partner } = useSelector((s) => s.auth)
  const [sidro, setSidro] = useState(null)

  const onLogout = async () => {
    await dispatch(logoutRemote())
    navigate('/login', { replace: true })
  }

  const aktivna = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))

  return (
    // Podloga i traka dolaze iz teme, kao u portalu: siva podloga #F3F6FB i
    // traka u brand plavoj, umjesto zatecene bijele.
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={1}>
        {/* Tri stupca umjesto space-between: naslov je srednji, a bocni stupci
            su jednake sirine (1fr) pa naslov stoji tocno na sredini trake bez
            obzira na to koliko je sirok gumb izbornika ili kontrole desno —
            isto kao u portalu. */}
        <Toolbar sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 1 }}>
          {/* LIJEVO — znak pa izbornik */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifySelf: 'start', minWidth: 0 }}>
            <BrandMark
              variant="h6"
              onPrimary
              sx={{ display: { xs: 'none', md: 'block' }, cursor: 'pointer', mr: 1 }}
              onClick={() => navigate('/search')}
            />
            {/* Stranice stoje u padajucem izborniku, kao u portalu: kartica po
                stranici trosi sirinu trake, a nedostupna kartica u njoj izgleda
                kao kvar umjesto kao "jos nije tu". */}
            <Button
              variant="outlined"
              onClick={(e) => setSidro(e.currentTarget)}
              startIcon={aktivna?.icon || <MenuIcon />}
              endIcon={<MenuIcon />}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                color: 'white',
                borderColor: 'rgba(255,255,255,0.5)',
                fontWeight: 700,
                px: 1.5,
                '&:hover': { borderColor: 'white' },
              }}
            >
              {aktivna?.label || 'Izbornik'}
            </Button>
            <Menu
              anchorEl={sidro}
              open={!!sidro}
              onClose={() => setSidro(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              PaperProps={{
                sx: { mt: 1, borderRadius: 3, minWidth: 260, boxShadow: '0 16px 40px rgba(15,23,42,0.18)' },
              }}
              MenuListProps={{ sx: { py: 0.5 } }}
            >
              {NAV_ITEMS.map((item) => (
                <MenuItem
                  key={item.path}
                  selected={item.path === aktivna?.path}
                  disabled={item.disabled}
                  onClick={() => {
                    setSidro(null)
                    navigate(item.path)
                  }}
                  sx={{ borderRadius: 1.5, mx: 1, my: 0.25, py: 0.75 }}
                >
                  <ListItemIcon sx={{ minWidth: 34 }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.disabled ? 'uskoro' : null}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: item.path === aktivna?.path ? 700 : 500 }}
                  />
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* SREDINA — samo naslov; znak stoji lijevo */}
          <Typography
            variant="h6"
            sx={{ display: { xs: 'none', md: 'block' }, justifySelf: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}
          >
            Partnerska prodaja
          </Typography>

          {/* DESNO */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ justifySelf: 'end' }}>
            {partner?.name && (
              <Stack alignItems="flex-end" sx={{ lineHeight: 1 }}>
                <Typography variant="body2" fontWeight={700}>
                  {partner.name}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {user?.username}
                </Typography>
              </Stack>
            )}
            <Button onClick={onLogout} variant="outlined" color="inherit" size="small" startIcon={<LogoutIcon />}>
              Odjava
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
