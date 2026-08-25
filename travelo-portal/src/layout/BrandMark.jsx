import { Box, Typography } from "@mui/material";

// Naziv aplikacije: "Travelo" u brand plavoj, "APP" u boji teksta.
// Isti znak koristi se na svim projektima — vidi boat-desk
// (renderer/src/components/common/BrandMark.jsx) i splash u njegovom main.cjs.
//
// Boje se uzimaju iz teme, ne upisuju rukom, da znak prati i tamnu varijantu.
//
// `onPrimary` je za mjesta gdje znak stoji NA plavoj podlozi (AppBar): ondje bi
// "Travelo" bio plavo na plavom i nestao.
//
// Pravilo je isto na obje podloge: "Travelo" nosi plavu, "APP" nosi neutralnu.
// Na bijeloj je to plava + tamna, na plavoj svijetloplava + bijela. Tako izgleda
// i zatečeni znak na ekranu prijave portala (assets/TraveloAppIcon.png).
//
// #96D1F2 je upisan jer je to brand sekundarna; portalova `secondary` je
// #0EA5E9, pretamna da bi se vidjela na #175BD0 (kontrast ~2.4:1).
// Izvezena je jer je istom bojom obojana i gornja traka portala.
export const BRAND_SECONDARY = "#96D1F2";

// Bez `variant` znak nasljeđuje veličinu i liniju od roditelja. To je važno kad
// stoji usred druge rečenice ("TraveloAPP - Admin portal"): ugniježđeni
// Typography s vlastitom veličinom i line-heightom prelomio bi redak i naziv bi
// završio iznad ostatka teksta.
// Ostali propovi (onClick, title, id…) idu na korijenski element, da se znak
// može koristiti i kao poveznica na početnu.
export default function BrandMark({ variant, onPrimary = false, sx, ...ostalo }) {
    const boje = {
        brand: onPrimary ? BRAND_SECONDARY : "primary.main",
        neutral: onPrimary ? "common.white" : "text.primary",
    };
    const sadrzaj = (
        <>
            <Box component="span" sx={{ color: boje.brand }}>Travelo</Box>
            <Box component="span" sx={{ color: boje.neutral }}>APP</Box>
        </>
    );

    if (!variant) {
        return (
            <Box component="span" sx={{ fontWeight: 800, letterSpacing: 0.5, ...sx }} {...ostalo}>
                {sadrzaj}
            </Box>
        );
    }

    return (
        <Typography
            variant={variant}
            component="span"
            sx={{ fontWeight: 800, letterSpacing: 0.5, lineHeight: 1, ...sx }}
            {...ostalo}
        >
            {sadrzaj}
        </Typography>
    );
}
