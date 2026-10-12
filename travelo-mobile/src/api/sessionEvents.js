// Javljanje da su kredencijali uređaja istekli. Interceptor u api/client.js
// nema pristup Reduxu, pa javi ovdje, a AppNavigator sluša i otvori prozor za
// novi OTP.
const slusaci = new Set();

export const naIstekSesije = (fn) => {
    slusaci.add(fn);
    return () => slusaci.delete(fn);
};

export const javiIstekSesije = () => {
    for (const fn of slusaci) {
        try { fn(); } catch (e) { /* slusac ne smije srusiti zahtjev */ }
    }
};
