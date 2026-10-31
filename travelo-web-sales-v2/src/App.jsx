import React, { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import Basket, { SelectedTickets } from './components/Basket.jsx';
import { Calendar, PortPicker, Check, Chevron } from './components/Controls.jsx';
import IslandTicket from './components/IslandTicket.jsx';
import PaymentResult from './components/PaymentResult.jsx';
import {
  newDraft, returnDraft, canReturn, total, cartTotal, removeTicket, todayISO, tripTimes, tripDuration, stopsText, disembarkationNote,
  regularPrices, islandPrice, hasPayingTicket, countsForTrip, orderData, validOib, MAX_PER_TYPE, HOLD_SECONDS,
} from './cart.js';
import { getHarbors, searchTrips, confirmOrder, sudregLookup } from './api.js';
import { translate } from './translations.js';

const EMPTY_BUYER = {
  name: '', email: '', company: false,
  companyName: '', taxId: '', address: '', postalCode: '', town: '', country: 'Hrvatska', accepted: false,
};

// Košarica se pamti samo za odlazak na Monri i povratak, da kupac kojem
// plaćanje ne prođe ne mora sve birati iznova.
const SAVED_KEY = 'kriloV2Checkout';
const saveCheckout = (value) => { try { sessionStorage.setItem(SAVED_KEY, JSON.stringify(value)); } catch { /* bez pohrane */ } };
const loadCheckout = () => { try { return JSON.parse(sessionStorage.getItem(SAVED_KEY) || 'null'); } catch { return null; } };
const clearCheckout = () => { try { sessionStorage.removeItem(SAVED_KEY); } catch { /* bez pohrane */ } };

// Povratak s Monrija: /v2/?order_number=…&status=…
const readReturn = () => {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const reference = q.get('order_number') || q.get('payment_reference');
  return reference ? { reference, status: (q.get('status') || '').toLowerCase() } : null;
};

// Podaci kupca u obliku koji backend već čita (summary_buyer_*).
const buyerData = (b) => ({
  summary_buyer_name: b.name.trim(),
  summary_buyer_email: b.email.trim(),
  summary_checkbox_term: b.accepted,
  ...(b.company ? {
    summary_buyer_company_name: b.companyName.trim(),
    summary_buyer_company_vat_id: b.taxId.trim(),
    summary_buyer_company_address: b.address.trim(),
    summary_buyer_company_postal_code: b.postalCode.trim(),
    summary_buyer_company_town: b.town.trim(),
    summary_buyer_company_country: b.country.trim(),
  } : {}),
});

export default function App() {
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem('kriloLanguage') === 'en' ? 'en' : 'hr'; } catch { return 'hr'; } });
  const [returned] = useState(readReturn);
  const [stage, setStage] = useState(returned ? 'result' : 'journey');
  const [harbors, setHarbors] = useState([]);
  const [cart, setCart] = useState([]);
  const [draft, setDraft] = useState(newDraft);
  const [trips, setTrips] = useState({ key: '', list: [], loading: false, error: '' });
  const [calendar, setCalendar] = useState(false);
  const [island, setIsland] = useState(false);
  const [questionId, setQuestionId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [expiry, setExpiry] = useState(null);
  const [remaining, setRemaining] = useState(HOLD_SECONDS);
  const [buyer, setBuyer] = useState(EMPTY_BUYER);
  const [oibNote, setOibNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const locale = language === 'en' ? 'en-GB' : 'hr-HR';
  const T = (t) => translate(t, language);
  const fmt = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : T('Odaberite datum'));
  const money = (n) => Number(n || 0).toLocaleString(locale, { style: 'currency', currency: 'EUR' });
  const parent = cart.find((t) => t.id === draft.parentId);
  const minimum = parent && parent.date > todayISO() ? parent.date : todayISO();

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('kriloLanguage', language); } catch { /* bez pohrane */ }
  }, [language]);

  // Bez luka se ne može ništa odabrati, pa se nakon greške (npr. 429) pokušava
  // ponovno dok ne uspije; poruka nestaje čim luke stignu.
  useEffect(() => {
    let timer;
    let cancelled = false;
    const load = () => getHarbors()
      .then((list) => { if (!cancelled) { setHarbors(list); setError(''); } })
      .catch((e) => { if (!cancelled) { setError(e.message); timer = setTimeout(load, 20000); } });
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!expiry) return undefined;
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiry - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiry]);

  // Polasci za odabranu relaciju i datum.
  const searchKey = draft.from && draft.to && draft.date ? `${draft.from.code}|${draft.to.code}|${draft.date}` : '';
  useEffect(() => {
    if (!searchKey) return undefined;
    let cancelled = false;
    setTrips({ key: searchKey, list: [], loading: true, error: '' });
    searchTrips(draft.from, draft.to, draft.date)
      .then((list) => { if (!cancelled) setTrips({ key: searchKey, list, loading: false, error: '' }); })
      .catch((e) => { if (!cancelled) setTrips({ key: searchKey, list: [], loading: false, error: e.message }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  function update(patch) {
    setDraft((d) => {
      const n = { ...d, ...patch };
      if ('from' in patch || 'to' in patch || 'date' in patch) n.trip = null;
      return n;
    });
    setError('');
  }

  function chooseTrip(trip) {
    // Količine ostaju pri promjeni polaska, ali samo za vrste koje taj polazak
    // prodaje; otočne karte vrijede samo za polazak za koji su provjerene.
    setDraft((d) => ({ ...d, trip, counts: countsForTrip(d.counts, trip), island: d.trip?.uuid === trip.uuid ? d.island : [] }));
    setError('');
  }

  function home() {
    setStage('journey');
    setDraft(newDraft());
    setEditingId(null);
    setError('');
  }

  function startReturn(t) {
    if (cart.some((r) => r.parentId === t.id)) return;
    setDraft(returnDraft(t));
    setStage('journey');
    setError('');
  }

  function proceed() {
    if (!draft.from || !draft.to || !draft.date) return setError('Odaberite luke i datum putovanja.');
    if (!draft.trip) return setError('Odaberite vrijeme polaska.');
    if (draft.date < todayISO() || (parent && !canReturn(parent, draft.trip))) return setError('Odaberite valjan datum.');
    setStage('tickets');
    setError('');
  }

  function save() {
    if (!hasPayingTicket(draft)) return setError('Odaberite barem jednu redovnu kartu.');
    if (parent && cart.some((t) => t.parentId === parent.id && t.id !== editingId)) return;
    const t = { ...draft, id: editingId || crypto.randomUUID(), counts: { ...draft.counts }, island: [...draft.island] };
    setCart((c) => (editingId ? c.map((item) => (item.id === editingId ? t : item)) : [...c, t]));
    setEditingId(null);
    if (!expiry || !remaining) setExpiry(Date.now() + HOLD_SECONDS * 1000);
    if (!draft.parentId) {
      setQuestionId(t.id);
      setStage('return-choice');
    } else {
      setStage('checkout');
    }
    setError('');
  }

  function backReturn() {
    setQuestionId(draft.parentId);
    setStage('return-choice');
    setError('');
  }

  function cancelSelection() {
    if (draft.parentId || cart.length) {
      setStage(cart.length ? 'checkout' : 'journey');
      setDraft(newDraft());
      setEditingId(null);
      setError('');
    } else {
      home();
    }
  }

  function editOutbound() {
    const t = cart.find((x) => x.id === questionId);
    if (!t) return home();
    setDraft({ ...t, counts: { ...t.counts }, island: [...t.island] });
    setEditingId(t.id);
    setStage('tickets');
    setError('');
  }

  function remove(id) {
    const n = removeTicket(cart, id);
    setCart(n);
    if (!n.length) { setExpiry(null); home(); }
  }

  function setCount(uuid, qty) {
    setDraft((d) => ({ ...d, counts: { ...d.counts, [uuid]: Math.max(0, Math.min(MAX_PER_TYPE, qty)) } }));
    setError('');
  }

  function newJourney() {
    clearCheckout();
    if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
    setCart([]);
    setExpiry(null);
    setBuyer(EMPTY_BUYER);
    home();
  }

  // Neuspjelo plaćanje: vrati košaricu i podatke kupca koji su bili poslani.
  function retryCheckout() {
    const saved = loadCheckout();
    if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
    if (!saved?.cart?.length) return newJourney();
    setCart(saved.cart);
    setBuyer({ ...EMPTY_BUYER, ...saved.buyer, accepted: false });
    setExpiry(Date.now() + HOLD_SECONDS * 1000);
    setStage('checkout');
  }

  async function lookupOib() {
    const oib = buyer.taxId.trim();
    if (!validOib(oib)) return;
    setOibNote('');
    try {
      const r = await sudregLookup(oib);
      if (r.found) {
        setBuyer((b) => ({
          ...b,
          companyName: r.naziv || b.companyName,
          address: r.adresa || b.address,
          town: r.mjesto || b.town,
          country: r.drzava || 'Hrvatska',
          email: b.email || r.email || '',
        }));
        setOibNote('Popunjeno iz sudskog registra.');
      } else {
        setOibNote('Nije pronađeno u sudskom registru — unesite ručno.');
      }
    } catch {
      setOibNote('Nije pronađeno u sudskom registru — unesite ručno.');
    }
  }

  async function pay(e) {
    e.preventDefault();
    if (!remaining) return setError('Vrijeme za dovršetak je isteklo. Ponovno odaberite polazak.');
    if (buyer.company && !validOib(buyer.taxId)) return setError('OIB tvrtke nije ispravan.');
    setSubmitting(true);
    setError('');
    const order_number = crypto.randomUUID();
    try {
      const res = await confirmOrder({ data: orderData(cart), order_number, buyer_data: buyerData(buyer), language });
      if (!res.payment_url) throw new Error('Plaćanje trenutno nije dostupno. Pokušajte ponovno.');
      saveCheckout({ cart, buyer: { ...buyer, accepted: false } });
      window.location.assign(res.payment_url);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  function field(key, label, type = 'text', extra = {}) {
    return (
      <div key={key}>
        <label htmlFor={key}>{T(label)}</label>
        <input
          id={key}
          type={type}
          required={extra.required !== false}
          value={buyer[key]}
          autoComplete={extra.autoComplete}
          inputMode={extra.inputMode}
          maxLength={extra.maxLength}
          pattern={extra.pattern}
          onBlur={extra.onBlur}
          onChange={(ev) => setBuyer({ ...buyer, [key]: ev.target.value })}
        />
      </div>
    );
  }

  const tripList = trips.key === searchKey ? trips : { list: [], loading: false, error: '' };
  const islandRow = islandPrice(draft.trip);
  const current = stage === 'journey' && !draft.parentId ? 0 : ['journey', 'tickets', 'return-choice'].includes(stage) ? 1 : 2;
  const question = cart.find((t) => t.id === questionId);
  // Ishod plaćanja može biti i neuspjeh, pa naslov ne zahvaljuje unaprijed.
  const heading = stage === 'result' ? 'Vaša rezervacija' : 'Gdje želite putovati?';
  const subheading = stage === 'result' ? 'Status plaćanja i preuzimanje karata' : 'Odaberite svoju liniju i rezervirajte kartu.';

  return (
    <>
      <Header {...{ language, setLanguage, T }} onHome={stage === 'result' ? newJourney : home} />
      <main>
        <div className="top">
          <div>
            <span className="eyebrow brand-label">KAPETAN LUKA FLEET</span>
            <h1>{T(heading)}</h1>
            <p style={{ margin: 0 }}>{T(subheading)}</p>
          </div>
        </div>
        <div className="steps">
          {['Putovanje', 'Karte', 'Plaćanje'].map((n, i) => (
            <div key={n} className={'step ' + (i <= current ? 'active' : '')}>
              <b>{i < current || stage === 'result' ? <Check /> : i + 1}</b>{T(n)}
            </div>
          ))}
        </div>
        <div className="layout">
          <section className="card">
            {stage === 'journey' && (
              <>
                {(draft.parentId || cart.length > 0) && (
                  <div className="return-navigation"><button className="cancel-booking" onClick={cancelSelection}>× {T('Odustani')}</button></div>
                )}
                <div className="fields">
                  <PortPicker label="Polazište" placeholder="Odaberite polazište" harbors={harbors} value={draft.from} onChange={(from) => update({ from })} locked={!!draft.parentId} otherPort={draft.to} T={T} />
                  <PortPicker label="Odredište" placeholder="Odaberite odredište" harbors={harbors} value={draft.to} onChange={(to) => update({ to })} locked={!!draft.parentId} otherPort={draft.from} T={T} />
                  <div className="departure-section">
                    <label>{T(draft.parentId ? 'Datum povratka' : 'Datum polaska')}</label>
                    <button className="date-field" onClick={() => setCalendar(true)}><span>▦</span><strong>{fmt(draft.date)}</strong><Chevron /></button>
                    {searchKey && (
                      <fieldset className="time-fieldset">
                        <legend>{T(draft.parentId ? 'Vrijeme povratka' : 'Vrijeme polaska')}</legend>
                        <p className="time-route">{draft.from.name} → {draft.to.name} · {fmt(draft.date)}</p>
                        {tripList.loading && <p className="date-hint">{T('Tražimo dostupne polaske…')}</p>}
                        {tripList.error && <p className="error" role="alert">{T(tripList.error)}</p>}
                        {!tripList.loading && !tripList.error && !tripList.list.length && (
                          <p className="date-hint">{T('Za odabrani datum nema polazaka na ovoj relaciji. Odaberite drugi datum.')}</p>
                        )}
                        <div className="time-options">
                          {tripList.list.map((trip) => {
                            const disabled = parent && !canReturn(parent, trip);
                            return (
                              <label key={trip.uuid} className={'time-option ' + (disabled ? 'unavailable' : '')}>
                                <input type="radio" name="sailing" checked={draft.trip?.uuid === trip.uuid} disabled={disabled} onChange={() => chooseTrip(trip)} />
                                <span>
                                  <strong>{tripTimes(trip).replace(' – ', ' → ')}</strong>
                                  <small>{disabled ? T('Povratak mora biti nakon dolaska.') : [tripDuration(trip), T(trip.stops?.length ? 'Linija sa stajanjima' : 'Izravna linija')].filter(Boolean).join(' · ')}</small>
                                  {!disabled && trip.stops?.length > 0 && <small>{T('Međuluke')}: {stopsText(trip)}</small>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {draft.trip?.stops?.length > 0 && (
                          <p className="route-disembarkation-note">*{T(disembarkationNote)}<br /><br />{T('Hvala na razumijevanju.')}</p>
                        )}
                      </fieldset>
                    )}
                  </div>
                </div>
                <div className="action">
                  {draft.parentId
                    ? <button className="back" onClick={backReturn}>← {T('Natrag')}</button>
                    : <span className="quiet">{T('Pronađite putovanje')}<br />{T('u nekoliko koraka.')}</span>}
                  <button className="primary" onClick={proceed}>{T('Odaberi karte')}</button>
                </div>
              </>
            )}

            {stage === 'tickets' && draft.trip && (
              <>
                <div className="checkout-title">
                  <h2>{T('Odaberi broj karata')}</h2>
                  <button className="cancel-booking" onClick={cancelSelection}>× {T('Odustani')}</button>
                </div>
                <p className="sub">{draft.from.name} → {draft.to.name} · {fmt(draft.date)} · {tripTimes(draft.trip)}</p>
                {draft.parentId && <p className="date-hint">{T('Količine su kopirane s polaznog putovanja. Možete ih izmijeniti.')}</p>}
                <div className="ticket-types">
                  {regularPrices(draft.trip).map((p) => {
                    const qty = draft.counts[p.ticket_type_uuid] || 0;
                    return (
                      <div className="ticket-type" key={p.ticket_type_uuid}>
                        <div>
                          <strong>{T(p.ticket_type_name)}</strong>
                          {p.description && <details><summary aria-label={T('Informacije o karti')}>ⓘ</summary><p>{p.description}</p></details>}
                          <p>{money(p.price)}</p>
                        </div>
                        <div className="counter-controls">
                          <button disabled={!qty} aria-label={T('Smanji') + ' ' + T(p.ticket_type_name)} onClick={() => setCount(p.ticket_type_uuid, qty - 1)}>−</button>
                          <output aria-live="polite">{qty}</output>
                          <button disabled={qty >= MAX_PER_TYPE} aria-label={T('Povećaj') + ' ' + T(p.ticket_type_name)} onClick={() => setCount(p.ticket_type_uuid, qty + 1)}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {islandRow && (
                  <div className="island-ticket-separate">
                    <button className="island-ticket-button" onClick={() => setIsland(true)}>
                      <span>▤</span>
                      <span><strong>{T('Otočna karta')}</strong><small>{T('Provjera prava na povlašteni prijevoz')}</small></span>
                      <span>＋</span>
                    </button>
                    {draft.island.map((t) => (
                      <div className="island-ticket-selected" key={t.card_no}>
                        <span>{T('Otočna karta')} · {t.card_no} · {money(t.price)}</span>
                        <button className="back" onClick={() => setDraft((d) => ({ ...d, island: d.island.filter((x) => x.card_no !== t.card_no) }))}>{T('Ukloni')}</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="action">
                  <button className="back" onClick={() => setStage('journey')}>← {T('Natrag')}</button>
                  <button className="primary" disabled={!hasPayingTicket(draft)} onClick={save}>{T('Nastavi')}</button>
                </div>
              </>
            )}

            {stage === 'return-choice' && (
              <>
                <h2>{T('Želite li povratnu kartu?')}</h2>
                <p className="sub">{T('Polazna karta je spremljena u košaricu.')}</p>
                {question && (
                  <div className="return-question-route">
                    <strong>{question.from.name} → {question.to.name}</strong>
                    <small>{fmt(question.date)}</small>
                  </div>
                )}
                {question && !cart.some((t) => t.parentId === questionId) && (
                  <button className="add-return return-question-yes" onClick={() => startReturn(question)}>
                    <span>＋</span>
                    <div><strong>{T('Da, dodaj povratnu kartu')}</strong><small>{T('Iste vrste i količine karata kopirat će se za povratak. Možete ih izmijeniti.')}</small></div>
                  </button>
                )}
                <div className="action">
                  <button className="back" onClick={editOutbound}>← {T('Natrag')}</button>
                  <button className="primary" onClick={() => setStage('checkout')}>{T('Ne, nastavi na plaćanje')}</button>
                </div>
              </>
            )}

            {stage === 'checkout' && (
              <>
                <div className="checkout-title">
                  <h2>{T('Odabrane karte')}</h2>
                  <span className="timer">◷ {T('Preostalo')} {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>
                </div>
                <p className="sub">{T('Pregled rezervacije i plaćanje')}</p>
                <SelectedTickets {...{ cart, T, fmt, money }} onRemove={remove} onReturn={startReturn} />
                <button className="primary buy-more-action" onClick={() => { setDraft(newDraft()); setStage('journey'); }}>+ {T('Kupi još karata')}</button>
                <h3 style={{ fontSize: 17 }}>{T('Podaci kupca')}</h3>
                <form onSubmit={pay}>
                  <label className="switch">
                    <input type="checkbox" checked={buyer.company} onChange={(ev) => setBuyer({ ...buyer, company: ev.target.checked })} />
                    {T('Tvrtka (R1 račun)')}
                  </label>
                  {buyer.company && (
                    <div className="fields company-fields">
                      {field('taxId', 'OIB', 'text', { inputMode: 'numeric', maxLength: 11, pattern: '[0-9]{11}', onBlur: lookupOib })}
                      {oibNote && <p className="date-hint">{T(oibNote)}</p>}
                      {field('companyName', 'Naziv tvrtke')}
                      {field('address', 'Adresa tvrtke')}
                      {field('postalCode', 'Poštanski broj', 'text', { inputMode: 'numeric', maxLength: 10 })}
                      {field('town', 'Mjesto')}
                      {field('country', 'Država')}
                    </div>
                  )}
                  <div className="fields">
                    {field('name', 'Ime i prezime kupca', 'text', { autoComplete: 'name' })}
                    {field('email', 'E-mail', 'email', { autoComplete: 'email' })}
                  </div>
                  <label className="checklabel">
                    <input type="checkbox" required checked={buyer.accepted} onChange={(ev) => setBuyer({ ...buyer, accepted: ev.target.checked })} />
                    <span>{T('Prihvaćam')} <a href={`https://krilo.hr/${language}/terms`} target="_blank" rel="noopener noreferrer">{T('opće uvjete kupovine i uvjete plaćanja')}</a>.</span>
                  </label>
                  <button className="primary checkout-pay" disabled={submitting || !remaining || !buyer.accepted || !cart.length}>
                    {T(submitting ? 'Preusmjeravamo na plaćanje…' : 'Nastavi na plaćanje')} · {money(cartTotal(cart))}
                  </button>
                </form>
                <p className="demo-note">{T('Plaćanje se obavlja na sigurnoj stranici Monri.')}</p>
                <div className="paymarks"><span>Mastercard</span><span>Maestro</span><span>VISA</span><span>American Express</span></div>
                <div className="action">
                  <button className="back" onClick={() => { setQuestionId([...cart].reverse().find((t) => !t.parentId)?.id); setStage('return-choice'); }}>← {T('Natrag')}</button>
                </div>
              </>
            )}

            {stage === 'result' && returned && (
              <PaymentResult
                reference={returned.reference}
                monriStatus={returned.status}
                {...{ T, money }}
                onNew={newJourney}
                onRetry={loadCheckout()?.cart?.length ? retryCheckout : null}
              />
            )}

            {error && <p className="error" role="alert">{T(error)}</p>}
          </section>
          {stage !== 'result' && <Basket {...{ cart, draft, stage, T, fmt, money }} onCheckout={() => setStage('checkout')} />}
        </div>
      </main>
      {island && draft.trip && (
        <IslandTicket
          {...{ T, money }}
          trip={draft.trip}
          usedCards={draft.island.map((t) => t.card_no)}
          onAdd={(t) => setDraft((d) => ({ ...d, island: [...d.island, t] }))}
          onClose={() => setIsland(false)}
        />
      )}
      {calendar && (
        <Calendar
          date={draft.date}
          min={minimum}
          title={draft.parentId ? 'Odaberite datum povratka' : 'Odaberite datum polaska'}
          onChoose={(date) => update({ date })}
          onClose={() => setCalendar(false)}
          {...{ T, locale }}
        />
      )}
    </>
  );
}
