import React, { useEffect, useState } from 'react';
import { ordersByReference, ticketsPdfUrl, invoicePdfUrl } from '../api.js';
import { Check } from './Controls.jsx';

// Narudžbe postoje od prije plaćanja, ali račun (invoice_uuid) nastaje tek kad
// Monri potvrdi uplatu i transakcije izdaju račun — zato se čeka da ga sve
// narudžbe dobiju. declined znači da uplata nije prošla.
const MAX_ATTEMPTS = 12;
const INTERVAL_MS = 1500;

const isReady = (list) => list.length > 0 && list.every((o) => o.invoice_uuid);
const isDeclined = (list) => list.some((o) => o.status === 'declined');

export default function PaymentResult({ reference, monriStatus, T, money, onNew, onRetry }) {
  const [state, setState] = useState({ phase: 'loading', orders: [] });

  useEffect(() => {
    let cancelled = false;
    let timer;
    const poll = async (attempt = 0) => {
      try {
        const list = await ordersByReference(reference);
        if (cancelled) return;
        if (isDeclined(list)) return setState({ phase: 'failed', orders: list });
        if (isReady(list)) return setState({ phase: 'done', orders: list });
        // Monri na odustajanje ne vraća approved, a narudžba ostaje neplaćena.
        if (monriStatus && !['approved', 'success', 'ok'].includes(monriStatus) && attempt >= 2) {
          return setState({ phase: 'failed', orders: list });
        }
        if (attempt < MAX_ATTEMPTS) {
          timer = setTimeout(() => poll(attempt + 1), INTERVAL_MS);
        } else {
          setState({ phase: list.length ? 'pending' : 'missing', orders: list });
        }
      } catch {
        if (!cancelled) setState({ phase: 'error', orders: [] });
      }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reference, monriStatus]);

  const { phase, orders } = state;
  const paid = orders.filter((o) => o.uuid);
  const invoiceUuid = orders.find((o) => o.invoice_uuid)?.invoice_uuid;
  const sum = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  if (phase === 'loading') {
    return (
      <div className="payment-success-header">
        <span className="payment-success-status">{T('Provjeravamo plaćanje…')}</span>
        <p>{T('Pripremamo vaše karte. Ovo traje nekoliko sekundi.')}</p>
      </div>
    );
  }

  if (phase === 'failed' || phase === 'error' || phase === 'missing') {
    const text = phase === 'failed'
      ? 'Plaćanje nije uspjelo ili je otkazano. Karte nisu izdane i iznos nije naplaćen.'
      : phase === 'missing'
        ? 'Narudžba nije pronađena.'
        : 'Provjera narudžbe nije uspjela. Pokušajte osvježiti stranicu.';
    return (
      <>
        <div className="payment-success-header">
          <span className="payment-success-status">{T('Plaćanje nije dovršeno')}</span>
          <p>{T(text)}</p>
        </div>
        <div className="action">
          {onRetry && <button className="back" onClick={onRetry}>← {T('Natrag na košaricu')}</button>}
          <button className="primary" onClick={onNew}>{T('Novo putovanje')}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="payment-success-header">
        <div className="payment-success-icon"><Check /></div>
        <span className="payment-success-status">{T('Plaćanje uspješno')}</span>
        <h2>{T('Vidimo se na moru!')}</h2>
        <p>{T(phase === 'pending'
          ? 'Uplata je zaprimljena. Račun se još izdaje — karte i račun stižu i na vaš e-mail.'
          : 'Vaše karte i račun spremni su za preuzimanje. Poslali smo ih i na vaš e-mail.')}</p>
      </div>
      <div className="payment-reference">
        <div><small>{T('Broj rezervacije')}</small><strong>{reference.slice(0, 8).toUpperCase()}</strong></div>
        <div><small>{T('Ukupno plaćeno')}</small><strong>{money(sum)}</strong></div>
      </div>
      <div className="payment-downloads">
        <div className="payment-download-card">
          <span className="payment-file-icon">▤</span>
          <div><h3>{T('Vaše karte')}</h3><p>{T('Sva odabrana putovanja na jednom mjestu.')}</p></div>
          <a className="primary" href={ticketsPdfUrl(paid.map((o) => o.uuid))} target="_blank" rel="noopener noreferrer">{T('Preuzmi karte')}</a>
        </div>
        <div className="payment-download-card">
          <span className="payment-file-icon">▧</span>
          <div><h3>{T('Vaš račun')}</h3><p>{T('Pregled stavki i ukupnog iznosa rezervacije.')}</p></div>
          {invoiceUuid
            ? <a className="payment-secondary" href={invoicePdfUrl(invoiceUuid)} target="_blank" rel="noopener noreferrer">{T('Preuzmi račun')}</a>
            : <span className="payment-secondary" aria-disabled="true">{T('Račun se izdaje…')}</span>}
        </div>
      </div>
      <div className="payment-reservation-list">
        <h3>{T('Pregled rezervacije')}</h3>
        {orders.map((o) => (
          <div className="payment-journey-group" key={o.uuid}>
            <div className="payment-journey-row">
              <div>
                <strong>{o.departure_harbor_name} → {o.arrival_harbor_name}</strong>
                <small>{[o.departure_date, o.departure_time].filter(Boolean).join(' · ')}</small>
              </div>
              <b>{money(Number(o.total_amount || 0))}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="action">
        <span />
        <button className="payment-secondary" onClick={onNew}>{T('Novo putovanje')}</button>
      </div>
    </>
  );
}
