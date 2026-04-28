import { createTheme } from "@mui/material/styles";

export const getTheme = (mode) =>
  createTheme({
    palette: {
      mode: mode === "light" ? "light" : "dark",
      primary: { main: "#3b82f6" },
    },
  });