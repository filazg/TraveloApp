// Prodaja polaska zatvara se ovoliko minuta prije vremena polaska. Isto pravilo
// vrijedi na backendu (travelo-sales-service/helpers/departureCutoff.js), koji
// narudžbu za zatvoreni polazak odbija s 409 — ovo je samo da partner takav
// polazak uopće ne vidi u rezultatima.
export const SALE_CUTOFF_MINUTES = 10;

// Vremena polazaka su hrvatska lokalna vremena zapisana kao tekst, bez oznake
// zone. Partner može sjediti u drugoj vremenskoj zoni ili imati krivo namješten
// sat na računalu, pa se "sada" računa u Europe/Zagreb umjesto preglednikove zone.
const TZ = 'Europe/Zagreb';

const localStamp = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi);

// departure_date je "DD/MM/YYYY", departure_time "HH:mm" — oblik koji vraća
// sales-service /routes. Vraća null ako zapis nije prepoznat.
const parseRouteDeparture = (route) => {
    const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(route?.departure_date || '').trim());
    const timeMatch = /^(\d{1,2}):(\d{2})/.exec(String(route?.departure_time || '').trim());
    if (!dateMatch || !timeMatch) return null;
    const [, d, mo, y] = dateMatch;
    const [, h, mi] = timeMatch;
    return localStamp(+y, +mo, +d, +h, +mi);
};

const nowInZagreb = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date).reduce((acc, p) => {
        if (p.type !== 'literal') acc[p.type] = Number(p.value);
        return acc;
    }, {});
    return localStamp(parts.year, parts.month, parts.day, parts.hour === 24 ? 0 : parts.hour, parts.minute);
};

// Neprepoznat zapis ne skriva polazak — backend ionako ima zadnju riječ.
export const isSaleOpen = (route, now = nowInZagreb()) => {
    const departure = parseRouteDeparture(route);
    if (departure === null) return true;
    return departure - SALE_CUTOFF_MINUTES * 60000 > now;
};
