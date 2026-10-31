import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDeparture, tripTimes, tripDuration, returnDraft, canReturn, groups, removeTicket, total, cartTotal,
  hasPayingTicket, countsForTrip, orderData, islandUnitPrice, validOib,
} from '../src/cart.js';
import { translate } from '../src/translations.js';

const prices = [
  { ticket_type_uuid: 'reg', ticket_type_name: 'Putna karta - Redovna', price: '25', is_island: false },
  { ticket_type_uuid: 'kid', ticket_type_name: 'Putna karta - Djeca 1-3', price: '0', is_island: false },
  { ticket_type_uuid: 'isl', ticket_type_name: 'Putna karta - Otočani', price: '3.7', is_island: true },
];
const trip = (uuid, dep, arr, extra = {}) => ({
  uuid, departure: dep, actual_departure: dep, arrival: arr, actual_arrival: arr,
  line_code: '645', line_name: 'SPLIT - HVAR', departure_harbor_id: 'HR479', arrival_harbor_id: 'HR364', prices, ...extra,
});
const split = { code: 'HR479', name: 'Split' }, hvar = { code: 'HR364', name: 'Hvar' };
const outbound = {
  id: 'a', parentId: null, from: split, to: hvar, date: '2026-11-03',
  trip: trip('t1', '03.11.2026. 09:00', '03.11.2026. 09:50'),
  counts: { reg: 2, kid: 1 }, island: [],
};

test('Departure text DD.MM.YYYY. HH:mm is parsed without Date', () => {
  assert.deepEqual(parseDeparture('03.11.2026. 09:00'), { date: '2026-11-03', time: '09:00' });
  assert.equal(parseDeparture('2026-11-03'), null);
  assert.equal(tripTimes(outbound.trip), '09:00 – 09:50');
  assert.equal(tripDuration(outbound.trip), '50 min');
});

test('Return reverses ports and copies quantities independently', () => {
  const r = returnDraft(outbound);
  assert.equal(r.from, hvar);
  assert.equal(r.to, split);
  assert.equal(r.parentId, 'a');
  assert.deepEqual(r.counts, outbound.counts);
  r.counts.reg = 5;
  assert.equal(outbound.counts.reg, 2);
  assert.deepEqual(r.island, []);
});

test('Return must depart after outbound arrival', () => {
  assert.equal(canReturn(outbound, trip('r1', '03.11.2026. 09:30', '03.11.2026. 10:20')), false);
  assert.equal(canReturn(outbound, trip('r2', '03.11.2026. 18:00', '03.11.2026. 18:50')), true);
  assert.equal(canReturn(outbound, trip('r3', '04.11.2026. 07:00', '04.11.2026. 07:50')), true);
});

test('Totals include regular and island tickets', () => {
  const leg = { ...outbound, island: [{ card_no: 'X1', ticket_type_uuid: 'isl', ticket_type_name: 'Otočna karta', price: 3.7 }] };
  assert.equal(total(leg), 53.7);
  assert.equal(cartTotal([outbound, leg]), 103.7);
});

test('Free tickets alone are not enough', () => {
  assert.equal(hasPayingTicket({ ...outbound, counts: { kid: 1 } }), false);
  assert.equal(hasPayingTicket({ ...outbound, counts: { kid: 1 }, island: [{ card_no: 'X' }] }), true);
  assert.equal(hasPayingTicket(outbound), true);
});

test('Counts keep only types the trip sells', () => {
  const other = { prices: [prices[0]] };
  assert.deepEqual(countsForTrip({ reg: 2, kid: 1 }, other), { reg: 2 });
});

test('Groups and removal keep return linked to outbound', () => {
  const back = { ...returnDraft(outbound), id: 'b', trip: trip('t2', '03.11.2026. 18:00', '03.11.2026. 18:50') };
  const cart = [outbound, back];
  assert.equal(groups(cart).length, 1);
  assert.equal(groups(cart)[0].back.id, 'b');
  assert.deepEqual(removeTicket(cart, 'a'), []);
  assert.deepEqual(removeTicket(cart, 'b').map((t) => t.id), ['a']);
});

test('Order data has one entry per leg with quantities and SEOP fields', () => {
  const leg = { ...outbound, island: [{ card_no: 'X1', ticket_type_uuid: 'isl', ticket_type_name: 'Otočna karta', price: 3.7, seop_discount_pct: 0, seop_pravo: 'P1', seop_otok: 'Hvar' }] };
  const [d] = orderData([leg]);
  assert.equal(d.sales_route_uuid, 't1');
  assert.deepEqual(d.ticketsData.map((t) => [t.ticket_type_uuid, t.quantity, t.is_island]), [['reg', 2, false], ['kid', 1, false], ['isl', 1, true]]);
  assert.equal(d.ticketsData[2].seop_card_no, 'X1');
});

test('Island price uses SEOP discount only when the line applies it', () => {
  assert.equal(islandUnitPrice({ price: '10' }, { popust_postotak: 50, primjeni_popust: true }), 5);
  assert.equal(islandUnitPrice({ price: '3.7' }, { popust_postotak: 50, primjeni_popust: false }), 3.7);
});

test('OIB check digit', () => {
  assert.equal(validOib('32137068117'), true);
  assert.equal(validOib('32137068118'), false);
  assert.equal(validOib('123'), false);
});

test('English translation', () => {
  assert.equal(translate('Odaberite polazište', 'en'), 'Choose departure port');
});

test('Intermediate stops are listed with arrival time', async () => {
  const { stopsText } = await import('../src/cart.js');
  assert.equal(stopsText({ stops: [{ harbor_name: 'Hvar', arrival: '03.11.2026. 15:50' }, { harbor_name: 'Milna', arrival: '03.11.2026. 16:10' }] }), 'Hvar 15:50 → Milna 16:10');
  assert.equal(stopsText({ stops: [] }), '');
  assert.equal(stopsText(null), '');
});
