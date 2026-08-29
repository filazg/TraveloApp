// Isto pravilo kao u travelo-web-sales-service/helpers/departureCutoff.js:
// prodaja polaska zatvara se SALE_CUTOFF_MINUTES minuta prije vremena polaska.
// Ovdje je pisano bez dayjs-a jer ga sales-service nema u ovisnostima — zonu
// rješava Intl, koji je dio Node-a.
//
// Vremena polazaka su hrvatska lokalna vremena zapisana kao tekst
// ("DD.MM.YYYY. HH:mm"), bez oznake zone. Poslužitelj radi u UTC-u, pa bi
// `new Date()` ljeti kasnio 2 sata (zimi 1) i karte bi se prodavale i nakon
// što je brod otišao.
const TZ = 'Europe/Zagreb';
const DEFAULT_CUTOFF_MINUTES = 10;

const cutoffMinutes = () => {
    const raw = Number(process.env.SALE_CUTOFF_MINUTES);
    return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_CUTOFF_MINUTES;
};

// Lokalno vrijeme se svodi na usporedivi broj (ms), bez obzira na zonu procesa.
// Obje strane usporedbe prolaze kroz isti postupak, pa se offset pokrati.
const localStamp = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi);

// "18.08.2026. 17:30" → stamp, ili null ako format nije prepoznat.
const parseDeparture = (value) => {
    const s = String(value || '').trim();
    const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?\s+(\d{1,2}):(\d{2})/.exec(s);
    if (!m) return null;
    const [, d, mo, y, h, mi] = m;
    return localStamp(+y, +mo, +d, +h, +mi);
};

// Trenutno vrijeme izraženo u hrvatskoj zoni, u istom obliku kao parseDeparture.
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

// Neprepoznat zapis NE blokira prodaju — pogrešan format bi inače u trenu ugasio
// cijeli plovidbeni red; umjesto toga se logira.
const isSaleOpen = (actualDeparture, now = nowInZagreb()) => {
    const departure = parseDeparture(actualDeparture);
    if (departure === null) {
        console.log('departureCutoff: neprepoznat zapis polaska, prodaja ostaje otvorena:', actualDeparture);
        return true;
    }
    return departure - cutoffMinutes() * 60000 > now;
};

const saleClosedMessage = (actualDeparture, language = 'hr') => {
    const minutes = cutoffMinutes();
    const when = String(actualDeparture || '').trim();
    if (language === 'hr') {
        return `Prodaja za polazak ${when} je zatvorena. Karte se prodaju najkasnije ${minutes} min prije polaska.`;
    }
    return `Sales for the ${when} departure are closed. Tickets are sold up to ${minutes} min before departure.`;
};

// Otkazan polazak se ne prodaje. Pretraga ga vise ne nudi, ali kupac moze
// sjediti na sazetku ili partner drzati otvoren dijalog kad dispecer otkaze
// plovidbu — bez ove provjere bi karta bila naplacena za brod koji ne ide.
const isSailingCanceled = (route) =>
    String(route?.sale_status || '').toUpperCase() === 'CANCELED' || route?.is_active === false;

const sailingCanceledMessage = (actualDeparture, language = 'hr') => {
    const when = String(actualDeparture || '').trim();
    if (language === 'hr') {
        return `Polazak ${when} je otkazan i karte za njega nije moguce kupiti.`;
    }
    return `The ${when} departure has been canceled and tickets are no longer available.`;
};

module.exports = {
    TZ,
    cutoffMinutes,
    parseDeparture,
    nowInZagreb,
    isSaleOpen,
    saleClosedMessage,
    isSailingCanceled,
    sailingCanceledMessage,
};
