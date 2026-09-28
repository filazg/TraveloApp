// Rok za storno s obzirom na polazak — isto pravilo kao u blagajni
// (travelo-boat-desk/electron/services/invoiceDataService.cjs, ocijeniRok).
//
// „Slobodno storniranje" (servisni izbornik): uključeno znači da storno nije
// vezan uz vrijeme polaska. Isključeno (zadano) — karta se može stornirati do
// ROK_NAKON_POLASKA_MIN minuta nakon polaska. Postavka je po uređaju.
import { getSetting, setSetting } from '../db/db';
import api from '../api/client';
import { ENDPOINTS } from '../api/config';

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

// Pokušaji storna izvan roka — Kontrola → Storniranje. Uređaj storno ne
// dopušta, ali pokušaj mora biti vidljiv. Bez veze se čuvaju u redu čekanja
// (settings, ključ ispod) i šalju iz AppNavigatora zajedno s ostalim zaostalim.
const KLJUC_RED = 'pending_storno_attempts';

const ucitajRed = async () => {
    try { return JSON.parse((await getSetting(KLJUC_RED)) || '[]') || []; } catch { return []; }
};

export const posaljiPokusajeStorna = async () => {
    const red = await ucitajRed();
    if (!red.length) return;
    const ostalo = [];
    for (const paket of red) {
        try {
            await api.post(ENDPOINTS.stornoAttempt, paket, { timeout: 15000 });
        } catch (e) {
            // 4xx neće proći ni kasnije; čuva se samo ono što je palo na mreži.
            const status = Number(e?.response?.status || 0);
            if (!status || status >= 500) ostalo.push(paket);
        }
    }
    await setSetting(KLJUC_RED, JSON.stringify(ostalo));
};

// `karte` su karte kojima je rok istekao, `rokovi` njihove ocjene.
export const prijaviPokusajeIzvanRoka = async (karte, { operator = null, terminalUuid = null, salesRoutes = [] } = {}) => {
    if (!karte?.length) return;
    const sada = new Date().toISOString();
    const paket = {
        source: 'mobile',
        operator,
        terminal_uuid: terminalUuid,
        slobodno_storniranje: await ucitajSlobodnoStorniranje(),
        attempts: karte.map((t) => ({
            ticket_uuid: t.ticket_uuid,
            ticket_code: t.ticket_code || null,
            ticket_type_name: t.ticket_type_name || null,
            single_price: t.single_price ?? null,
            line_code: t.line_code || null,
            line_name: t.line_name || null,
            departure_harbor_name: t.departure_harbor_name || null,
            arrival_harbor_name: t.arrival_harbor_name || null,
            route_uuid: t.route_uuid || null,
            departure_planed: t.departure_planed || null,
            polazak: polazakZaRok(t, salesRoutes),
            attempted_at: sada,
        })),
    };
    const red = await ucitajRed();
    red.push(paket);
    await setSetting(KLJUC_RED, JSON.stringify(red));
    posaljiPokusajeStorna().catch(() => {});
};
