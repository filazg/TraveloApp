import { Typography } from "@mui/material";

// Naslov stranice iznad kartica (tabova) — isti izgled na svim stranicama
// modula, kao na SEOP stranici. Tekst je naziv stavke iz izbornika modula.
export default function PageTitle({ children, sx }) {
    return (
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, ...sx }}>
            {children}
        </Typography>
    );
}
