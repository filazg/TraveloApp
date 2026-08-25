import { createTheme } from "@mui/material/styles";

// TraveloApp brand paleta — ista koju koriste web-sales i mobilna aplikacija.
// Blagajna je dosad bila na zadanoj MUI temi (bijelo na bijelom, Tailwind plava),
// pa se kartice nisu razlikovale od pozadine.
//
// Ključ kontrasta: pozadina je topla krem, kartice su bijele. Ne obrnuto.
const brand = {
  primary: "#175BD0",
  primaryDark: "#0F4BA8",
  secondary: "#96D1F2",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#D97706",
};

const light = {
  bg: "#F5F2EB",        // topla krem — pozadina aplikacije
  surface: "#FFFFFF",   // kartice, modali, tablice
  surfaceAlt: "#FAF8F3",// zaglavlja tablica, sekundarne plohe
  border: "#E5E0D6",
  textPrimary: "#383E42",
  textSecondary: "#5C656B",
  // Stavke unutar stupaca prodaje (polasci, tipovi karata, košarica) su
  // kartice u kartici — na bijeloj plohi bi se stopile, pa dobivaju blagi
  // plavi ton iz brand boje i plavkasti rub.
  accentSurface: "#EEF4FE",
  accentBorder: "#CFE0F8",
  // Zaglavlje stupca — tamnije od krem plohe da se naslov jasno odvoji od
  // sadržaja ispod.
  headerSurface: "#D8D3C5",
};

// Tamna varijanta zadržava isti odnos: pozadina tamnija od kartica.
const dark = {
  bg: "#12161A",
  surface: "#1B2127",
  surfaceAlt: "#222932",
  border: "#2E3742",
  textPrimary: "#E8EAED",
  textSecondary: "#A8B0B8",
  accentSurface: "#1B2B45",
  accentBorder: "#2C4670",
  headerSurface: "#0E1216",
};

// Blagajna se koristi prstom na dodirnom ekranu — polja i gumbi su zato viši
// od MUI zadanih, a razmaci širi da se ne promašuje susjedni element.
const CONTROL_HEIGHT = 56;

export const getTheme = (mode) => {
  const isLight = mode !== "dark";
  const c = isLight ? light : dark;

  return createTheme({
    palette: {
      mode: isLight ? "light" : "dark",
      primary: { main: brand.primary, dark: brand.primaryDark },
      secondary: { main: brand.secondary },
      error: { main: brand.danger },
      success: { main: brand.success },
      warning: { main: brand.warning },
      background: { default: c.bg, paper: c.surface },
      text: { primary: c.textPrimary, secondary: c.textSecondary },
      divider: c.border,
      // Vlastita boja izvan MUI standarda — zaglavlja stupaca prodaje.
      columnHeader: c.headerSurface,
    },

    shape: { borderRadius: 12 },

    typography: {
      fontFamily: '"Inter", "Segoe UI", Roboto, Arial, sans-serif',
      // MUI zadano je 14; blagajna se gleda s veće udaljenosti nego obično
      // sučelje, pa je osnovica podignuta. Sve varijante (body, naslovi, gumbi)
      // skaliraju se odavde, pa nema potrebe dirati pojedine komponente.
      fontSize: 16,
      button: { fontWeight: 700, letterSpacing: 0.2 },
    },

    components: {
      // Pozadina cijele aplikacije — bez ovoga MUI ostavlja bijelo.
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: c.bg },
        },
      },

      // Kartice se od pozadine odvajaju sjenom i rubom, ne samo rubom.
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: c.surface,
          },
          outlined: {
            borderColor: c.border,
            boxShadow: isLight
              ? "0 1px 3px rgba(56, 62, 66, 0.06), 0 1px 2px rgba(56, 62, 66, 0.04)"
              : "0 1px 3px rgba(0, 0, 0, 0.4)",
          },
        },
        variants: [
          // Stavke unutar stupaca prodaje — kartica u kartici. Blagi plavi ton
          // ih odvaja od bijele plohe stupca, bez vike.
          {
            props: { variant: "accent" },
            style: {
              backgroundColor: c.accentSurface,
              border: `1px solid ${c.accentBorder}`,
              borderRadius: 12,
              boxShadow: "none",
            },
          },
        ],
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: CONTROL_HEIGHT,
            paddingInline: 20,
            borderRadius: 10,
            textTransform: "uppercase",
          },
          // Gumbi u modalima i alatnim trakama znaju biti manji od blagajničkih.
          sizeSmall: { minHeight: 40, paddingInline: 12 },
        },
      },

      MuiTextField: {
        defaultProps: { size: "medium" },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            borderRadius: 10,
            minHeight: CONTROL_HEIGHT,
          },
          notchedOutline: { borderColor: c.border },
        },
      },

      // Tablice računa i karata — zaglavlje na alternativnoj plohi da se odvoji
      // od redaka, redovi bez oštrih linija.
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: `1px solid ${c.border}`,
            borderRadius: 12,
            backgroundColor: c.surface,
          },
          columnHeaders: {
            backgroundColor: c.surfaceAlt,
            borderBottom: `1px solid ${c.border}`,
          },
          cell: { borderBottom: `1px solid ${c.border}` },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16 },
        },
      },
    },
  });
};
