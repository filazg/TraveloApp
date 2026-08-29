import { AppBar, Box, Button, Stack, Tab, Tabs, Toolbar, Typography } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import SearchIcon from '@mui/icons-material/Search'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logoutRemote } from '../features/auth/authSlice'
import BrandMark from './BrandMark'

const NAV_ITEMS = [
  { path: '/search', label: 'Prodaja', icon: <SearchIcon fontSize="small" /> },
  { path: '/reservations', label: 'Moje rezervacije', icon: <ReceiptLongIcon fontSize="small" />, disabled: true },
]

export default function AppLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, partner } = useSelector((s) => s.auth)

  const onLogout = async () => {
    await dispatch(logoutRemote())
    navigate('/login', { replace: true })
  }

  const activeTab = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))?.path || false

  return (
    // Podloga i traka dolaze iz teme, kao u portalu: siva podloga #F3F6FB i
    // traka u brand plavoj, umjesto zatecene bijele.
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar sx={{ gap: 4 }}>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 0, whiteSpace: 'nowrap' }}>
            <BrandMark onPrimary /> - Partnerska prodaja
          </Typography>

          <Tabs
            value={activeTab}
            onChange={(_, v) => v && navigate(v)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ minHeight: 48 }}
          >
            {NAV_ITEMS.map((item) => (
              <Tab
                key={item.path}
                value={item.path}
                label={item.label}
                icon={item.icon}
                iconPosition="start"
                disabled={item.disabled}
                sx={{ fontWeight: 700, minHeight: 48 }}
              />
            ))}
          </Tabs>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={2} alignItems="center">
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
