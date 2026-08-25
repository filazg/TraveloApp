import { Box, Typography } from "@mui/material";

// Naziv aplikacije: "Travelo" u brand plavoj, "APP" u boji teksta.
// Isti znak koristi se na svim projektima — vidi boat-desk
// (renderer/src/components/common/BrandMark.jsx) i splash u njegovom main.cjs.
//
// Boje se uzimaju iz teme, ne upisuju rukom, da znak prati i tamnu varijantu.
export default function BrandMark({ variant = "h6", color, sx }) {
    return (
        <Typography
            variant={variant}
            component="span"
            sx={{ fontWeight: 800, letterSpacing: 0.5, lineHeight: 1, ...sx }}
        >
            <Box component="span" sx={{ color: color || "primary.main" }}>Travelo</Box>
            <Box component="span" sx={{ color: color || "text.primary" }}>APP</Box>
        </Typography>
    );
}
