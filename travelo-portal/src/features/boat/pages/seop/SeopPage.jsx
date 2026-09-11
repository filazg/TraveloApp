import { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import SeopPanel from "./SeopPanel";
import MosiPanel from "./MosiPanel";

// Integracije prema AKD-u.
//
// Dva sustava, dvije kartice: SEOP je evidencija izdanih i iskorištenih putnih
// karata (otočne iskaznice), MOSI je dojava korištenja invalidskih povlastica.
// Zajedničko im je samo to što oba drži AKD i oba traže certifikat — sve ostalo
// je različito (SOAP prema REST-u, certifikat za vezu prema certifikatu samo za
// potpis), pa se administriraju odvojeno.
//
// Kartica se ne prikazuje dok se ne odabere, da se prema servisima ne odlazi po
// podatke koje nitko nije tražio.
export default function SeopPage() {
    const [kartica, setKartica] = useState(0);

    return (
        <Box sx={{ width: "100%", maxWidth: 1100 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                Integracije — AKD
            </Typography>

            <Tabs
                value={kartica}
                onChange={(_e, v) => setKartica(v)}
                sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
            >
                <Tab label="SEOP" sx={{ fontWeight: 800 }} />
                <Tab label="MOSI" sx={{ fontWeight: 800 }} />
            </Tabs>

            {kartica === 0 ? <SeopPanel /> : <MosiPanel />}
        </Box>
    );
}
