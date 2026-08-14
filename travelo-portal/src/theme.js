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
    // Jedinstveni izgled svih tablica (preuzeto iz bus portala):
    // kompaktni redci, tonirano podebljano zaglavlje, sitniji tekst u ćelijama,
    // pointer na hoveru (redak je klikabilan) i prigušeni neaktivni redci preko
    // klase "row-inactive" koju stranice dodaju kroz getRowClassName.
    MuiDataGrid: {
      defaultProps: {
        // Kao na bus stranicama (javna_usluga, monthly, pricing): redak 34px
        // umjesto MUI defaulta 52px, zaglavlje 38px umjesto 56px.
        density: "compact",
        rowHeight: 34,
        columnHeaderHeight: 38,
        pageSizeOptions: [25, 50, 100],
        // Stranice koje same postave initialState zadržavaju svoju paginaciju.
        initialState: { pagination: { paginationModel: { pageSize: 50 } } },
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: "rgba(23,91,208,0.06)",
          },
          "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700 },
          "& .MuiDataGrid-cell": { fontSize: 13 },
          "& .MuiDataGrid-row:hover": { cursor: "pointer" },
          "& .row-inactive": { opacity: 0.45 },
        },
      },
    },
  },
});
