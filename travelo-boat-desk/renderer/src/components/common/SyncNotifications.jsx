import { useEffect, useState } from "react";
import { Alert, AlertTitle, Box, Slide, Stack } from "@mui/material";

// Obavijesti o promjenama koje je poslužitelj javio sam.
//
// Plovidbeni red se osvježi tiho, ali blagajnik mora saznati ŠTO se promijenilo:
// polazak koji je maloprije nudio više ne postoji, ili se vratio, ili je
// pomaknut. Bez toga bi mu ponuda ispod ruke nestala bez objašnjenja.
//
// Obavijest sama ne nestaje — gasi je blagajnik križićem, kad ju je pročitao.
// Prodaja se ne prekida: stoji sa strane i ne uzima fokus.
const VRSTE = [
    { kljuc: "otkazani", naslov: "Polazak otkazan", boja: "error" },
    { kljuc: "vraceni", naslov: "Polazak ponovno u prodaji", boja: "success" },
    { kljuc: "pomaknuti", naslov: "Polazak pomaknut", boja: "warning" },
];

export default function SyncNotifications() {
    const [obavijesti, setObavijesti] = useState([]);

    useEffect(() => {
        const odjavi = window.api?.app?.onDataRefreshed?.((poruka) => {
            const promjene = poruka?.promjene;
            if (!promjene) return;
            const nove = [];
            for (const vrsta of VRSTE) {
                for (const opis of promjene[vrsta.kljuc] || []) {
                    nove.push({
                        id: `${vrsta.kljuc}-${opis}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                        naslov: vrsta.naslov,
                        boja: vrsta.boja,
                        opis,
                    });
                }
            }
            if (!nove.length) return;
            // Novije ide na vrh, a popis se drži kratkim: dulji od desetak
            // obavijesti nitko ne čita, a pokrio bi pola ekrana.
            setObavijesti((prije) => [...nove, ...prije].slice(0, 10));
        });
        return () => { if (typeof odjavi === "function") odjavi(); };
    }, []);

    const zatvori = (id) => setObavijesti((prije) => prije.filter((o) => o.id !== id));

    if (!obavijesti.length) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                top: 16,
                right: 16,
                zIndex: (theme) => theme.zIndex.modal + 600,
                width: { xs: "90vw", sm: 420 },
                pointerEvents: "none",
            }}
        >
            <Stack spacing={1}>
                {obavijesti.map((o) => (
                    <Slide key={o.id} direction="left" in mountOnEnter unmountOnExit>
                        <Alert
                            severity={o.boja}
                            variant="filled"
                            onClose={() => zatvori(o.id)}
                            sx={{ pointerEvents: "auto", boxShadow: 6, alignItems: "flex-start" }}
                        >
                            <AlertTitle sx={{ fontWeight: 800, mb: 0.25 }}>{o.naslov}</AlertTitle>
                            {o.opis}
                        </Alert>
                    </Slide>
                ))}
            </Stack>
        </Box>
    );
}
