// Zajednički izgled modala s tablicom (računi, karte, smjene). Prije je svaki
// nosio svoju kopiju: fiksna širina 400 pa `width: '100%'` preko nje, crni okvir
// 2px i grey[900] na zaglavljima — u svijetloj temi gotovo crno.

// Okvir modala: radna ploha, kao i prodajni ekran.
export const gridModalSx = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "96%",
    height: "90%",
    // Modal fokusira svoj okvir, pa Chrome oko njega crta focus ring.
    outline: "none",
    bgcolor: "background.default",
    borderRadius: 3,
    boxShadow: 24,
    p: 3,
    display: "flex",
    flexDirection: "column",
};

// Tablica uzima preostalu visinu, a zaglavlja idu na istu boju kao naslovi
// stupaca na prodajnom ekranu.
export const gridBoxSx = {
    flex: 1,
    minHeight: 0,
    "& .MuiDataGrid-root": {
        bgcolor: "background.paper",
        borderRadius: 3,
    },
    "& .MuiDataGrid-columnHeader": {
        backgroundColor: "columnHeader",
    },
    "& .MuiDataGrid-columnHeaderTitle": {
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
};
