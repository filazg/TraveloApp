import { Box, Typography } from "@mui/material";

// Naziv aplikacije kako stoji na splashu: "Travelo" u brand plavoj, "APP" u
// boji teksta. Na jednom mjestu, da splash, prijava i zaglavlje blagajne ne
// odu jedno od drugog.
//
// Boje se uzimaju iz teme, pa radi i u tamnoj — splash ih ima upisane rukom
// jer se crta iz main procesa, prije nego renderer uopće postoji.
export default function BrandMark({ variant = "h6", sx }) {
    return (
        <Typography
            variant={variant}
            component="span"
            sx={{ fontWeight: 800, letterSpacing: 0.5, lineHeight: 1, ...sx }}
        >
            <Box component="span" sx={{ color: "primary.main" }}>Travelo</Box>
            <Box component="span" sx={{ color: "text.primary" }}>APP</Box>
        </Typography>
    );
}
