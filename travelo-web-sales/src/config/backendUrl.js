// Adresa backenda za SPA.
//
// Redoslijed:
//   1. VITE_BACKEND_URL — kad treba gađati drugi poslužitelj nego onaj s kojeg
//      je stranica otvorena.
//   2. origin same stranice + putanja na kojoj nginx vrti gateway. Time portal
//      otvoren na domeni gađa domenu, a otvoren preko IP-a gađa taj IP — bez
//      CORS-a i bez ijedne postavke pri deployu.
//   3. lokalni gateway, za `npm run dev`.
//
// Prije se adresa birala ručnom zastavicom u kodu, pa je build za poslužitelj
// znao ostati okrenut na localhost.
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export const resolveBackendUrl = (gatewayPath = '/app', devUrl = 'http://localhost:5100') => {
    const fromEnv = import.meta.env.VITE_BACKEND_URL;
    if (fromEnv) return String(fromEnv).replace(/\/$/, '');

    if (typeof window !== 'undefined' && window.location) {
        const host = window.location.hostname;
        if (host && !LOCAL_HOSTS.includes(host)) {
            return `${window.location.origin}${gatewayPath}`;
        }
    }
    return devUrl;
};
