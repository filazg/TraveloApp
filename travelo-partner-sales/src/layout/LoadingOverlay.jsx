import { Backdrop, CircularProgress, Stack, Typography } from '@mui/material'
import { useSelector } from 'react-redux'

// Zaslon učitavanja za cijelu aplikaciju.
//
// zIndex mora biti IZNAD modala: rezervacija se potvrđuje u dijalogu, a dijalog
// u MUI-ju stoji na zIndex.modal — prekrivač ispod njega ne bi se vidio baš
// ondje gdje najviše treba. Isto pravilo vrijedi i u portalu.
export default function LoadingOverlay() {
    const sales = useSelector((s) => s.sales)
    const auth = useSelector((s) => s.auth)

    // Poruka govori što se čeka. "Učitavanje…" bez objašnjenja ostavlja dojam da
    // je aplikacija stala, pogotovo dok cjenik stiže s poslužitelja.
    const poruka = sales.orderSubmitting
        ? 'Rezervacija u tijeku…'
        : sales.pricesLoading
            ? 'Dohvat cjenika…'
            : sales.loading
                ? 'Dohvat podataka…'
                : auth.loading
                    ? 'Prijava…'
                    : ''

    return (
        <Backdrop
            open={!!poruka}
            sx={{
                color: '#fff',
                zIndex: (theme) => theme.zIndex.modal + 500,
                backdropFilter: 'blur(2px)',
            }}
        >
            <Stack alignItems="center" spacing={2}>
                <CircularProgress color="inherit" />
                <Typography sx={{ fontWeight: 700 }}>{poruka}</Typography>
            </Stack>
        </Backdrop>
    )
}
