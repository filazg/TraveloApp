import Typography from "@mui/material/Typography";

// Uputa iznad tablice — ista formulacija na svim stranicama.
// Pripadajuće ponašanje retka je u helpers/gridRowActions.js.
export default function GridHint({ withToggle = true, text }) {
    return (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            {text || (withToggle
                ? "Klik na redak — uredi · Dupli klik — aktiviraj/deaktiviraj"
                : "Klik na redak — uredi")}
        </Typography>
    );
}
