import { useEffect, useState } from "react";
import { Alert, Box, LinearProgress, Slide, Typography } from "@mui/material";

// Nenametljiva obavijest o automatskom ažuriranju. Update je automatski (vidi
// electron/services/updateService.cjs): preuzima u pozadini, a instalira se tek
// dok je app na prijavnom ekranu. Ova traka samo informira — nema gumba, ne
// uzima fokus i ne prekida prodaju. Stoji dolje lijevo da ne smeta obavijestima
// o plovidbenom redu (gore desno).
export default function UpdateNotice() {
  const [stanje, setStanje] = useState(null); // { phase, percent, version }

  useEffect(() => {
    const off = window?.api?.app?.onUpdateStatus?.((p) => setStanje(p));
    return () => { if (typeof off === "function") off(); };
  }, []);

  if (!stanje) return null;

  const { phase, percent = 0, version } = stanje;

  // Tihe faze — ništa ne prikazuj (provjera, nema novosti, greška u pozadini).
  if (phase === "checking" || phase === "none" || phase === "error") return null;

  let severity = "info";
  let tekst = null;
  let prikaziTraku = false;

  if (phase === "available") {
    tekst = `Dostupna je nova verzija${version ? ` ${version}` : ""} — preuzimam…`;
    prikaziTraku = true;
  } else if (phase === "downloading") {
    tekst = `Preuzimanje nove verzije${version ? ` ${version}` : ""}… ${percent}%`;
    prikaziTraku = true;
  } else if (phase === "downloaded") {
    severity = "success";
    tekst = "Nova verzija je spremna — primjenjuje se pri odjavi.";
  } else if (phase === "installing") {
    severity = "warning";
    tekst = "Instaliram novu verziju, aplikacija će se ponovno pokrenuti…";
  } else {
    return null;
  }

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: (theme) => theme.zIndex.modal + 600,
        width: { xs: "90vw", sm: 380 },
        pointerEvents: "none",
      }}
    >
      <Slide direction="right" in mountOnEnter unmountOnExit>
        <Alert severity={severity} variant="filled" sx={{ boxShadow: 6, pointerEvents: "auto" }}>
          <Typography sx={{ fontWeight: 700 }}>{tekst}</Typography>
          {prikaziTraku ? (
            <LinearProgress
              variant={phase === "downloading" ? "determinate" : "indeterminate"}
              value={percent}
              sx={{ mt: 1, borderRadius: 1 }}
            />
          ) : null}
        </Alert>
      </Slide>
    </Box>
  );
}
