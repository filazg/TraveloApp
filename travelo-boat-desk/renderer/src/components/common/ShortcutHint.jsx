import { Box } from "@mui/material";
import { useSelector } from "react-redux";
import { allAppData } from "../../store/appSlice";
import { tipkaZaRadnju } from "./shortcutActions";

// Oznaka dodijeljene tipke uz natpis gumba, npr. "KARTICA (F2)". Ne prikazuje
// se ništa dok operater ne dodijeli tipku, pa gumbi ostaju čisti onima koji
// prečace ne koriste.
//
// Blijeđa je i manja od natpisa — podatak je pomoćni i ne smije se čitati kao
// dio naziva.
export default function ShortcutHint({ action }) {
    const appData = useSelector(allAppData);
    const tipka = tipkaZaRadnju(appData.operatorSettings?.shortcuts, action);
    if (!tipka) return null;
    return (
        <Box
            component="span"
            sx={{ ml: 0.75, fontSize: "0.75em", fontWeight: 700, opacity: 0.75 }}
        >
            ({tipka})
        </Box>
    );
}
