import { createTheme } from "@mui/material";
import image from "./pic/brod.png";

// Brand palette
const BRAND = {
  primary: "#2E53A0",     // deep blue
  primarySoft: "#D0E4FE", // light blue (accent / hover / selected row)
  beige: "#F5F2EB",       // warm cream (page background)
  ink: "#383E42",         // dark slate (text)
};

// Display font (wide) — only for headings/buttons. Body uses a legible sans.
const DISPLAY_STACK = `"owners-xxwide", "Segoe UI", Roboto, system-ui, -apple-system, sans-serif`;
const BODY_STACK = `"Inter", "Segoe UI", Roboto, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

export const theme = createTheme({
  backgroundImage: `url(${image})`,

  typography: {
    fontFamily: BODY_STACK,
    fontSize: 14,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    // Headings get the brand display font
    h1: { fontFamily: DISPLAY_STACK, fontSize: "2.25rem", lineHeight: 1.15, letterSpacing: "-0.01em" },
    h2: { fontFamily: DISPLAY_STACK, fontSize: "1.75rem", lineHeight: 1.2 },
    h3: { fontFamily: DISPLAY_STACK, fontSize: "1.375rem", lineHeight: 1.25 },
    h4: { fontFamily: DISPLAY_STACK, fontSize: "1.15rem", lineHeight: 1.3 },
    h5: { fontFamily: DISPLAY_STACK, fontSize: "1.05rem", lineHeight: 1.35 },
    h6: { fontFamily: DISPLAY_STACK, fontSize: "0.95rem", lineHeight: 1.4 },
    // Body / UI copy stays in the legible sans
    subtitle1: { fontFamily: BODY_STACK, fontSize: "0.95rem" },
    subtitle2: { fontFamily: BODY_STACK, fontSize: "0.85rem" },
    body1: { fontFamily: BODY_STACK, fontSize: "0.9rem" },
    body2: { fontFamily: BODY_STACK, fontSize: "0.82rem" },
    caption: { fontFamily: BODY_STACK, fontSize: "0.72rem" },
    button: { fontFamily: BODY_STACK, fontSize: "0.875rem", letterSpacing: 0.2, fontWeight: 700 },
  },

  palette: {
    primary: {
      main: BRAND.primary,
      light: BRAND.primarySoft,
      dark: "#1f3b75",
      contrastText: "#ffffff",
    },
    secondary: {
      main: BRAND.primarySoft,
      contrastText: BRAND.ink,
    },
    background: {
      default: BRAND.beige,
      paper: "#ffffff",
    },
    text: {
      primary: BRAND.ink,
      secondary: "#5c646a",
    },
    divider: "rgba(56, 62, 66, 0.12)",
    otherColor: { main: "#999" },
  },

  shape: { borderRadius: 10 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: BRAND.beige,
          color: BRAND.ink,
          fontFamily: BODY_STACK,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: BRAND.primary,
          color: "#ffffff",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 10,
          fontWeight: 700,
        },
        containedPrimary: {
          boxShadow: "0 6px 16px rgba(46, 83, 160, 0.25)",
          "&:hover": { boxShadow: "0 8px 22px rgba(46, 83, 160, 0.3)" },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: "rgba(46, 83, 160, 0.35)",
          color: BRAND.ink,
          "&.Mui-selected": {
            backgroundColor: BRAND.primarySoft,
            color: BRAND.primary,
            "&:hover": { backgroundColor: BRAND.primarySoft },
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.select:hover": {
            backgroundColor: BRAND.primarySoft,
            cursor: "pointer",
          },
          "&.Mui-selected, &.Mui-selected:hover": {
            backgroundColor: BRAND.primarySoft,
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#ffffff",
            borderRadius: 10,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
  },
});

export { BRAND };
