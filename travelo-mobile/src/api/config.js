// Gateway base URL for the mobile app. Persisted per-device in SQLite after
// first successful pairing — the default below is just a hint shown in
// PairingScreen for fresh devices.
export const DEFAULT_GATEWAY_URL = 'https://bookingtest.krilo.hr/app';

// Endpoints (paths are concatenated with gateway URL).
export const ENDPOINTS = {
    // Pairing: returns { token } on success.
    terminalLogin: '/terminal_auth/login/terminalLogin',
    // Zero-touch: po serijskom broju vraća {mode:'auto', token, tid} ili {mode:'manual', tid}.
    terminalCheckPairing: '/terminal_auth/login/terminalCheckPairing',
    // Master data sync (requires Authorization header with token).
    basicData: '/terminals/terminal/basic_data',
    transportData: '/terminals/terminal/transport_data',
    // POS sale — forwards to transactions-service /finalize_terminal_sale.
    finalizeSale: '/terminals/terminal/finalize_sale',
    // Validacija — povuci sve karte za odabrani polazak (svi prodajni kanali).
    voyageTickets: '/terminals/terminal/voyage_tickets',
    // Validacija — označi kartu validiranom.
    validateTicket: '/terminals/terminal/validate_ticket',
    // Adresar kupaca — sync iz invoices.
    buyers: '/terminals/terminal/buyers',
    // SEOP provjera otočne iskaznice (proxy → akd-service).
    checkIslandCard: '/terminals/terminal/check_island_card',
    // Storno karata — proxy na transactions /cancel_tickets.
    cancelTickets: '/terminals/terminal/cancel_tickets',
    // Smjene — upsert (POST) + lista (GET).
    shift: '/terminals/terminal/shift',
    shifts: '/terminals/terminal/shifts',
};

// Today's date as "DD/MM/YYYY" — matches the string format stored in routes.departure_date.
export const todayDmy = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
