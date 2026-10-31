// Košarica nove web prodaje. Jedno putovanje (leg) je jedan polazak s
// odabranim kartama; povratak je zaseban leg s parentId polaznog.
//
// leg = {
//   id, parentId,
//   from, to        — luke iz /harbors ({ code, name, … })
//   date            — YYYY-MM-DD
//   trip            — polazak iz /search_trips (uuid, departure, prices, …)
//   counts          — { [ticket_type_uuid]: količina } za obične karte
//   island          — otočne karte, svaka za jednu provjerenu iskaznicu
// }

export const MAX_PER_TYPE = 12;
export const HOLD_SECONDS = 15 * 60;

export const disembarkationNote = 'Nije dozvoljeno napuštati plovilo u lukama na putu do konačne destinacije. Iskrcaj je dopušten isključivo u konačnoj destinaciji navedenoj na karti.';

// Polasci stižu kao tekst "DD.MM.YYYY. HH:mm" — new Date() ga ne čita.
export function parseDeparture(text) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\.?\s+(\d{2}):(\d{2})/.exec(String(text || ''));
  if (!m) return null;
  return { date: `${m[3]}-${m[2]}-${m[1]}`, time: `${m[4]}:${m[5]}` };
}

// Ključ za usporedbu "YYYY-MM-DD HH:mm".
export function departureKey(text) {
  const p = parseDeparture(text);
  return p ? `${p.date} ${p.time}` : '';
}

export function tripTimes(trip) {
  if (!trip) return '';
  const dep = parseDeparture(trip.actual_departure || trip.departure);
  const arr = parseDeparture(trip.actual_arrival || trip.arrival);
  return [dep?.time, arr?.time].filter(Boolean).join(' – ');
}

// Međuluke iz pretrage (trip.stops) kao "Hvar 15:50 → Milna 16:10".
export function stopsText(trip) {
  return (trip?.stops || [])
    .map((st) => [st.harbor_name, parseDeparture(st.arrival)?.time].filter(Boolean).join(' '))
    .join(' → ');
}

export function tripDuration(trip) {
  const dep = departureKey(trip?.actual_departure || trip?.departure);
  const arr = departureKey(trip?.actual_arrival || trip?.arrival);
  if (!dep || !arr) return '';
  const min = Math.round((new Date(arr.replace(' ', 'T')) - new Date(dep.replace(' ', 'T'))) / 60000);
  if (!(min > 0)) return '';
  const h = Math.floor(min / 60), r = min % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

export function regularPrices(trip) {
  return (trip?.prices || []).filter((p) => !p.is_island);
}

export function islandPrice(trip) {
  return (trip?.prices || []).find((p) => p.is_island) || null;
}

export function priceOf(trip, ticketTypeUuid) {
  const p = (trip?.prices || []).find((x) => x.ticket_type_uuid === ticketTypeUuid);
  return p ? Number(p.price || 0) : 0;
}

// Cijena otočne karte, kao na desku i mobilnoj: ili popust SEOP-a na otočnu
// cijenu iz cjenika (primjeni_popust) ili cijena iz cjenika kao konačna.
export function islandUnitPrice(priceRow, result) {
  const base = Number(priceRow?.price || 0);
  const pct = Number(result?.popust_postotak || 0);
  return result?.primjeni_popust ? +(base * (1 - pct / 100)).toFixed(2) : +base.toFixed(2);
}

export function ticketLines(leg) {
  const lines = regularPrices(leg.trip)
    .filter((p) => (leg.counts[p.ticket_type_uuid] || 0) > 0)
    .map((p) => {
      const qty = leg.counts[p.ticket_type_uuid];
      return { key: p.ticket_type_uuid, name: p.ticket_type_name, qty, price: Number(p.price || 0), amount: qty * Number(p.price || 0) };
    });
  for (const t of leg.island || []) {
    lines.push({ key: `island-${t.card_no}`, name: t.ticket_type_name, note: t.card_no, qty: 1, price: t.price, amount: t.price });
  }
  return lines;
}

export function total(leg) {
  return +ticketLines(leg).reduce((s, l) => s + l.amount, 0).toFixed(2);
}

export function cartTotal(cart) {
  return +cart.reduce((s, leg) => s + total(leg), 0).toFixed(2);
}

// Barem jedna karta koja se plaća ili otočna — samo besplatne (djeca 1-3)
// ne putuju bez odrasle osobe.
export function hasPayingTicket(leg) {
  if ((leg.island || []).length) return true;
  return regularPrices(leg.trip).some((p) => (leg.counts[p.ticket_type_uuid] || 0) > 0 && Number(p.price) > 0);
}

export function groups(cart) {
  return cart.filter((t) => !t.parentId).map((t) => ({ outbound: t, back: cart.find((r) => r.parentId === t.id) }));
}

export function removeTicket(cart, id) {
  return cart.filter((t) => t.id !== id && t.parentId !== id);
}

export function newDraft() {
  return { id: null, parentId: null, from: null, to: null, date: '', trip: null, counts: {}, island: [] };
}

// Povratak: luke obrnute i zaključane, količine kopirane (neovisno se mijenjaju).
// Otočne karte se ne kopiraju — pravo se provjerava za svaku relaciju i datum.
export function returnDraft(parent) {
  return {
    ...newDraft(),
    parentId: parent.id,
    from: parent.to,
    to: parent.from,
    date: parent.date,
    counts: { ...parent.counts },
  };
}

// Povratak mora krenuti nakon dolaska polaznog putovanja.
export function canReturn(parent, trip) {
  if (!parent?.trip || !trip) return true;
  const arrival = departureKey(parent.trip.actual_arrival || parent.trip.arrival);
  const dep = departureKey(trip.actual_departure || trip.departure);
  return !arrival || !dep || dep > arrival;
}

// Količine prenesene na drugi polazak zadržavaju samo vrste koje taj polazak prodaje.
export function countsForTrip(counts, trip) {
  const out = {};
  for (const p of regularPrices(trip)) {
    if (counts[p.ticket_type_uuid]) out[p.ticket_type_uuid] = counts[p.ticket_type_uuid];
  }
  return out;
}

// Tijelo za /order_confirmation: jedna stavka po putovanju. Cijene računa
// sales servis; ovdje idu samo vrste, količine i SEOP podaci otočnih karata.
export function orderData(cart) {
  return cart.map((leg) => {
    const ticketsData = regularPrices(leg.trip)
      .filter((p) => (leg.counts[p.ticket_type_uuid] || 0) > 0)
      .map((p) => ({
        ticket_type_uuid: p.ticket_type_uuid,
        ticket_type_name: p.ticket_type_name,
        quantity: leg.counts[p.ticket_type_uuid],
        is_island: false,
      }));
    for (const t of leg.island || []) {
      ticketsData.push({
        ticket_type_uuid: t.ticket_type_uuid,
        ticket_type_name: t.ticket_type_name,
        quantity: 1,
        is_island: true,
        seop_card_no: t.card_no,
        seop_pravo: t.seop_pravo,
        seop_otok: t.seop_otok,
        seop_discount_pct: t.seop_discount_pct,
      });
    }
    const trip = leg.trip;
    return {
      sales_route_uuid: trip.uuid,
      line_code: trip.line_code,
      line_name: trip.line_name,
      departure: trip.departure,
      departure_harbor_id: trip.departure_harbor_id,
      departure_harbor_name: trip.departure_harbor_name,
      arrival: trip.arrival,
      arrival_harbor_id: trip.arrival_harbor_id,
      arrival_harbor_name: trip.arrival_harbor_name,
      ticketsData,
    };
  });
}

// OIB kontrolna znamenka (ISO 7064, MOD 11,10).
export function validOib(o) {
  const s = String(o || '').trim();
  if (!/^\d{11}$/.test(s)) return false;
  let r = 10;
  for (let i = 0; i < 10; i++) {
    r = (r + +s[i]) % 10;
    if (r === 0) r = 10;
    r = (r * 2) % 11;
  }
  return (11 - r) % 10 === +s[10];
}

export function todayISO() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((k) => p.find((v) => v.type === k).value).join('-');
}

export function shiftDay(date, days) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
