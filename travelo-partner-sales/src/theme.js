import { createTheme } from '@mui/material/styles'

// Ista tema kao u portalu (travelo-portal/src/theme.js). Partnerska prodaja je
// dio istog sustava i partner je vidi odmah do portala i karata, pa se ne smije
// razlikovati po boji, fontu ni zaobljenju.
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#175BD0' }, // brand plava
    secondary: { main: '#0EA5E9' },
    background: { default: '#F3F6FB', paper: '#FFFFFF' },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: [
      'Inter',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 12, height: 44 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'medium' },
    },
    // Tablice prate izgled portalskih popisa: tonirano podebljano zaglavlje i
    // sitniji tekst u celijama.
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(23,91,208,0.06)',
          '& .MuiTableCell-head': { fontWeight: 700 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        body: { fontSize: 13 },
      },
    },
  },
})
