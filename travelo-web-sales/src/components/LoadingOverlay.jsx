import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { webSalesDataSlice } from '../pages/webSalesSlice';

// Globalni full-screen loading overlay — prikazuje se kad je
// state.globalLoading.active = true. Mount-an na vrhu WebSalesPage-a.
export default function LoadingOverlay() {
    const data = useSelector(webSalesDataSlice);
    const { active, message } = data?.globalLoading || {};
    return (
        <Backdrop
            open={!!active}
            sx={{ zIndex: (theme) => theme.zIndex.modal + 100, color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress color="inherit" size={64} thickness={4} />
                <Typography variant="h6" sx={{ color: '#fff', textAlign: 'center', maxWidth: 360 }}>
                    {message || 'Obrada u tijeku…'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#cbd5e1', textAlign: 'center', maxWidth: 360 }}>
                    Molimo pričekajte, ne zatvarajte ovaj prozor.
                </Typography>
            </Box>
        </Backdrop>
    );
}
