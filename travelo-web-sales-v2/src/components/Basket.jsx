import React from 'react';
import { groups, total, ticketLines, tripTimes, cartTotal, stopsText, disembarkationNote } from '../cart.js';

// Međuluke i napomena da se na njima ne smije iskrcati (samo kad ih ima).
export function RouteNotes({ trip, T }) {
  if (!trip?.stops?.length) return null;
  return (
    <>
      <p className="basket-route-stops">{T('Međuluke')}: {stopsText(trip)}</p>
      <p className="route-disembarkation-note">*{T(disembarkationNote)}<br /><br />{T('Hvala na razumijevanju.')}</p>
    </>
  );
}

export function TicketLeg({ ticket, T, fmt, money, onRemove }) {
  return (
    <div className="basket-leg">
      <div className="basket-leg-top">
        <strong>{T(ticket.parentId ? 'Povratak' : 'Odlazak')}</strong>
        {onRemove && <button className="remove" onClick={() => onRemove(ticket.id)}>{T('Ukloni')}</button>}
      </div>
      <h3>{ticket.from?.name} → {ticket.to?.name}</h3>
      <p>{fmt(ticket.date)} · {tripTimes(ticket.trip)}</p>
      <RouteNotes trip={ticket.trip} T={T} />
      <div className="table-scroll">
        <table>
          <thead><tr>{['Tip karte', 'Količina', 'Cijena', 'Iznos'].map((x) => <th key={x}>{T(x)}</th>)}</tr></thead>
          <tbody>
            {ticketLines(ticket).map((l) => (
              <tr key={l.key}>
                <td>{T(l.name)}{l.note ? <small style={{ display: 'block' }}>{l.note}</small> : null}</td>
                <td>{l.qty}</td>
                <td>{money(l.price)}</td>
                <td>{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SelectedTickets({ cart, onRemove, onReturn, T, fmt, money }) {
  return groups(cart).map(({ outbound, back }) => (
    <section className="ticket grouped-ticket" key={outbound.id}>
      <div className="ticket-top">
        <span>{T(back ? 'Povratno putovanje' : 'Odabrane karte')}</span>
        <strong>{money(total(outbound) + (back ? total(back) : 0))}</strong>
      </div>
      <TicketLeg ticket={outbound} {...{ T, fmt, money, onRemove }} />
      {back
        ? <TicketLeg ticket={back} {...{ T, fmt, money, onRemove }} />
        : <button className="add-return ticket-return-action" onClick={() => onReturn(outbound)}>+ {T('Dodaj povratnu kartu')}</button>}
    </section>
  ));
}

function CompactLeg({ ticket, fmt, money }) {
  return (
    <div className="compact-journey-leg">
      <strong>{ticket.from?.name} → {ticket.to?.name}</strong>
      <div><span>{fmt(ticket.date)}</span><b>{money(total(ticket))}</b></div>
    </div>
  );
}

function SideDetails({ ticket, T, money }) {
  return (
    <div className="side-details-leg">
      <strong>{T(ticket.parentId ? 'Povratak' : 'Odlazak')}</strong>
      <small style={{ display: 'block', marginTop: 6 }}>{tripTimes(ticket.trip)}</small>
      {ticket.trip?.stops?.length > 0 && <p className="basket-route-stops">{T('Međuluke')}: {stopsText(ticket.trip)}</p>}
      {ticketLines(ticket).map((l) => (
        <div className="summary-ticket-line" key={l.key}>
          <span>{l.qty} × {T(String(l.name).replace('Putna karta - ', ''))}</span>
          <b>{money(l.amount)}</b>
        </div>
      ))}
    </div>
  );
}

export default function Basket({ cart, draft, stage, T, fmt, money, onCheckout }) {
  return (
    <aside className="card summary">
      <h2 className="journey-summary-title">{T('Vaše putovanje')}</h2>
      {cart.length ? groups(cart).map(({ outbound, back }) => (
        <div className="compact-journey-group" key={outbound.id}>
          <CompactLeg ticket={outbound} {...{ fmt, money }} />
          {back && <CompactLeg ticket={back} {...{ fmt, money }} />}
          <details className="journey-details">
            <summary>{T('Detalji putovanja')} ⌄</summary>
            <SideDetails ticket={outbound} {...{ T, money }} />
            {back && <SideDetails ticket={back} {...{ T, money }} />}
          </details>
        </div>
      )) : (
        <>
          <div className="route">
            <div className="line" />
            <div>
              <small>{T('POLAZIŠTE')}</small>
              <strong>{draft.from?.name || T('Odaberite polazište')}</strong>
              <div className="end">
                <small>{T('ODREDIŠTE')}</small>
                <strong>{draft.to?.name || T('Odaberite odredište')}</strong>
              </div>
            </div>
          </div>
          <div className="row"><span>{T('Datum putovanja')}</span><b>{fmt(draft.date)}</b></div>
          {stage === 'tickets' && draft.trip && (
            <details className="journey-details" open>
              <summary>{T('Detalji putovanja')} ⌄</summary>
              <SideDetails ticket={draft} {...{ T, money }} />
            </details>
          )}
        </>
      )}
      <div className="row total">
        <span>{T('Ukupno')}</span>
        <strong>{cart.length ? money(cartTotal(cart)) : stage === 'tickets' ? money(total(draft)) : '—'}</strong>
      </div>
      {cart.length > 0 && !['checkout', 'result'].includes(stage) && (
        <button className="primary" onClick={onCheckout}>{T('Povratak u košaricu')} →</button>
      )}
    </aside>
  );
}
