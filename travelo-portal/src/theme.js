import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#175BD0" }, // plava
    secondary: { main: "#0EA5E9" }, // svjetlija plava
    background: { default: "#F3F6FB", paper: "#FFFFFF" },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: [
      "Inter",
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Roboto",
      "Arial",
      "sans-serif",
    ].join(","),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 12, height: 44 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "medium" },
    },
  },
});
