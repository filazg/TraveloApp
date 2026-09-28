// Rok za storno s obzirom na polazak — isto pravilo kao u blagajni
// (travelo-boat-desk/electron/services/invoiceDataService.cjs, ocijeniRok).
//
// „Slobodno storniranje" (servisni izbornik): uključeno znači da storno nije
// vezan uz vrijeme polaska. Isključeno (zadano) — karta se može stornirati do
// ROK_NAKON_POLASKA_MIN minuta nakon polaska. Postavka je po uređaju.
import { getSetting, setSetting } from '../db/db';

export const ROK_NAKON_POLASKA_MIN = 30;

const KLJUC = 'free_storno';

export const ucitajSlobodnoStorniranje = async () => (await getSetting(KLJUC)) === '1';

export const spremiSlobodnoStorniranje = (ukljuceno) => setSetting(KLJUC, ukljuceno ? '1' : '0');

// Polazak stiže u više oblika: ruta i karta pišu "28.08.2026. 10:00",
// poslužitelj zna vratiti i ISO. new Date() prvi oblik ne zna pročitati.
const parsirajPolazak = (vrijednost) => {
    const s = String(vrijednost || '').trim();
    if (!s) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5]);
    const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?\s+(\d{1,2}):(\d{2})/.exec(s);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1], +dmy[4], +dmy[5]);
    return null;
};

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Polazak po kojem se mjeri rok. Pomaknut polazak vrijedi po novom vremenu
// (actual_departure) — brod koji kasni još nije isplovio. Ako rute više nema u
// sinkroniziranim podacima, vrijedi vrijeme zapisano na karti.
export const polazakZaRok = (karta, salesRoutes = []) => {
    const uuid = karta?.route_uuid || karta?.sales_route_uuid;
    const ruta = uuid ? (salesRoutes || []).find((r) => r.uuid === uuid) : null;
    if (ruta) {
        return ruta.actual_departure
            || ruta.departure
            || (ruta.departure_date && ruta.departure_time ? `${ruta.departure_date} ${ruta.departure_time}` : null)
            || karta?.departure_planed;
    }
    return karta?.departure_planed || karta?.departure || null;
};

// Nepoznat ili neprepoznat polazak ne blokira storno — radije propustiti nego
// zaustaviti povrat na podatku koji se nije dao pročitati.
export const ocijeniRok = (polazakText, slobodno = false) => {
    if (slobodno) return { allowed: true, reason: '', warning: '' };
    const polazak = parsirajPolazak(polazakText);
    if (!polazak) return { allowed: true, reason: '', warning: '' };
    const proteklo = Math.floor((Date.now() - polazak.getTime()) / 60000);
    if (proteklo <= 0) return { allowed: true, reason: '', warning: '' };
    const preostalo = ROK_NAKON_POLASKA_MIN - proteklo;
    if (preostalo <= 0) {
        return {
            allowed: false,
            reason: `Rok za storno je istekao — brod je isplovio u ${hhmm(polazak)}, a storno je moguć još ${ROK_NAKON_POLASKA_MIN} min nakon polaska.`,
            warning: '',
        };
    }
    return {
        allowed: true,
        reason: '',
        warning: `Brod je isplovio u ${hhmm(polazak)} — za storno je ostalo još ${preostalo} min.`,
    };
};
