import { Box, Paper, Typography } from "@mui/material";

// Stupac prodajnog ekrana s naslovom u vrhu. Prije su stupci bili gole kartice
// bez oznake, pa se nije vidjelo što je što — pogotovo kad su prazni.
//
// Visina se prilagođava prozoru: naslov i podnožje su fiksni, a sredina raste i
// smanjuje se. Blagajne imaju različite ekrane, pa fiksna visina znači da na
// nižem ekranu sadržaj ispada, a na višem ostaje prazan prostor.
//
// `footer` je za sadržaj koji mora ostati prikovan za dno stupca (npr. gumb
// "Dodaj odabrano") — ne skrola se zajedno s listom iznad.
export default function ColumnPanel({ title, footer, children }) {
    return (
        <Paper
            variant="outlined"
            sx={{
                height: "100%",
                borderRadius: 3,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                sx={{
                    px: 2,
                    py: 1,
                    bgcolor: "columnHeader",
                    borderBottom: 1,
                    borderColor: "divider",
                    flexShrink: 0,
                }}
            >
                <Typography
                    variant="subtitle2"
                    align="center"
                    sx={{
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: "text.secondary",
                    }}
                >
                    {title}
                </Typography>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0, // bez ovoga flex dijete ne da skrolati, nego se rastegne
                    p: 1,
                    overflowY: "auto",
                    overflowX: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    // Traka za pomicanje se skriva — blagajnik skrola mišem ili
                    // prstom, a traka samo jede širinu stupca.
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": { display: "none" },
                }}
            >
                {children}
            </Box>

            {footer ? (
                <Box sx={{ p: 1, flexShrink: 0, borderTop: 1, borderColor: "divider" }}>
                    {footer}
                </Box>
            ) : null}
        </Paper>
    );
}
