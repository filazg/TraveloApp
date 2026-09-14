import { Box, Stack, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { authSliceData } from "../auth/authSlice";

// Zaglavlje ulaznog ekrana modula: naziv, podnaslov i traka u boji modula.
//
// Tekst i boja se čitaju iz kataloga modula, ne prepisuju se po stranicama —
// katalog je već jedini izvor za naslovnicu i izbornik, pa se promjena naziva
// vidi svugdje odjednom. Prije su se ti ekrani otvarali ravno u mrežu kartica,
// bez ijedne riječi o tome gdje se čovjek nalazi.
const pickLocalized = (val, lang) => {
    if (val == null) return "";
    if (typeof val === "string") return val;
    return val[lang] || val.hr || val.en || Object.values(val)[0] || "";
};

export default function ModulZaglavlje({ modulKey, naslov, podnaslov, boja }) {
    const authData = useSelector(authSliceData);
    const lang = authData?.selectedLanguage?.code || "hr";
    const katalog = authData?.modulesCatalog?.modules || [];
    const m = katalog.find((x) => x.key === modulKey);

    const tekstNaslov = naslov || pickLocalized(m?.title, lang);
    const tekstPodnaslov = podnaslov || pickLocalized(m?.subtitle, lang);
    const trakaBoja = boja || m?.color || "#175BD0";

    if (!tekstNaslov && !tekstPodnaslov) return null;

    return (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Box sx={{ width: 6, height: 36, borderRadius: 1, bgcolor: trakaBoja, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" fontWeight={800} noWrap>{tekstNaslov}</Typography>
                {tekstPodnaslov ? (
                    <Typography color="text.secondary" fontSize={13} noWrap>{tekstPodnaslov}</Typography>
                ) : null}
            </Box>
        </Stack>
    );
}
