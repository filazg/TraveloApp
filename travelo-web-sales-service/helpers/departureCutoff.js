const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// Vremena polazaka su hrvatska lokalna vremena zapisana kao tekst
// ("DD.MM.YYYY. HH:mm"), bez ikakve oznake zone. Poslužitelj na DO-u radi u UTC-u,
// pa bi `new Date()` / `dayjs()` ljeti kasnio 2 sata (zimi 1) i karte bi se
// prodavale i nakon što je brod otišao. Zato se i polazak i "sada" računaju
// eksplicitno u Europe/Zagreb.
const TZ = 'Europe/Zagreb';

// Prodaja se zatvara ovoliko minuta PRIJE polaska. Promjenjivo bez diranja koda
// preko SALE_CUTOFF_MINUTES (npr. 0 = prodaja do samog polaska). Isto ime koristi
// i sales-service, da web i partnerska prodaja ne mogu odlutati na različite pragove.
const DEFAULT_CUTOFF_MINUTES = 10;

const cutoffMinutes = () => {
    const raw = Number(process.env.SALE_CUTOFF_MINUTES);
    return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_CUTOFF_MINUTES;
};

const pad = (v) => String(v).padStart(2, '0');

// "18.08.2026. 17:30" → dayjs u Europe/Zagreb. Vraća null ako format nije prepoznat.
const parseDeparture = (value) => {
    const s = String(value || '').trim();
    const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?\s+(\d{1,2}):(\d{2})/.exec(s);
    if (!m) return null;
    const [, d, mo, y, h, min] = m;
    const stamp = `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(min)}`;
    const parsed = dayjs.tz(stamp, 'YYYY-MM-DD HH:mm', TZ);
    return parsed.isValid() ? parsed : null;
};

const nowInZagreb = () => dayjs().tz(TZ);

// Je li prodaja za taj polazak još otvorena. Neprepoznat zapis NE blokira prodaju —
// pogrešan format bi inače u trenu ugasio cijeli vozni red; umjesto toga se logira.
const isSaleOpen = (actualDeparture, now = nowInZagreb()) => {
    const departure = parseDeparture(actualDeparture);
    if (!departure) {
        console.log('departureCutoff: neprepoznat zapis polaska, prodaja ostaje otvorena:', actualDeparture);
        return true;
    }
    return departure.subtract(cutoffMinutes(), 'minute').isAfter(now);
};

// Poruka za kupca kad pokuša platiti polazak kojem je prodaja u međuvremenu zatvorena.
const saleClosedMessage = (actualDeparture, language = 'hr') => {
    const minutes = cutoffMinutes();
    const when = String(actualDeparture || '').trim();
    if (language === 'hr') {
        return `Prodaja za polazak ${when} je zatvorena. Karte se prodaju najkasnije ${minutes} min prije polaska.`;
    }
    return `Sales for the ${when} departure are closed. Tickets are sold up to ${minutes} min before departure.`;
};

module.exports = {
    TZ,
    cutoffMinutes,
    parseDeparture,
    nowInZagreb,
    isSaleOpen,
    saleClosedMessage,
};
