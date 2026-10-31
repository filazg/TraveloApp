import React, { useEffect, useRef, useState } from 'react';
import { checkIslandCard } from '../api.js';
import { islandPrice, islandUnitPrice } from '../cart.js';

const KINDS = [['card_no', 'Broj iskaznice'], ['oib', 'OIB putnika'], ['iks', 'Broj iksice']];

// Otočna karta: pravo se provjerava kroz SEOP (check_island_card) za odabrani
// polazak. Po iskaznici uvijek jedna karta.
export default function IslandTicket({ T, money, trip, usedCards, onAdd, onClose }) {
  const ref = useRef();
  const [kind, setKind] = useState('card_no');
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { ref.current.showModal(); }, []);

  const priceRow = islandPrice(trip);
  const id = value.trim();
  const valid = kind === 'oib' ? /^\d{11}$/.test(id) : id.length >= 3;
  const label = KINDS.find(([k]) => k === kind)[1];
  const unit = result?.ima_pravo ? islandUnitPrice(priceRow, result) : null;

  const reset = () => { setResult(null); setError(''); };

  const check = async (e) => {
    e.preventDefault();
    if (!valid || checking) return;
    if (usedCards.includes(id)) return setError('Ova iskaznica je već dodana za ovo putovanje.');
    setChecking(true);
    reset();
    try {
      setResult(await checkIslandCard(kind, id, trip));
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const add = () => {
    onAdd({
      card_no: id,
      ticket_type_uuid: priceRow.ticket_type_uuid,
      ticket_type_name: 'Otočna karta',
      price: unit,
      // Stvarno primijenjeni popust — 0 kad linija cijenu daje iz cjenika.
      seop_discount_pct: result.primjeni_popust ? Number(result.popust_postotak || 0) : 0,
      seop_pravo: result.pravo_na_pp || null,
      seop_otok: result.otok || null,
    });
    onClose();
  };

  return (
    <dialog ref={ref} className="island-dialog" onCancel={onClose} aria-labelledby="island-title">
      <div className="island-title"><h2 id="island-title">{T('Otočna karta — provjera prava')}</h2></div>
      <form onSubmit={check}>
        <div className="island-body">
          <p>{T('Upišite serijski broj otočne iskaznice ili OIB putnika. Sustav provjerava pravo na povlašteni prijevoz i izračunava cijenu.')}</p>
          <div className="fields">
            <div>
              <label htmlFor="island-kind">{T('Upisujem')}</label>
              <select id="island-kind" value={kind} onChange={(e) => { setKind(e.target.value); setValue(''); reset(); }}>
                {KINDS.map(([key, name]) => <option key={key} value={key}>{T(name)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="island-id">{T(label)}</label>
              <input id="island-id" value={value} autoComplete="off" inputMode={kind === 'oib' ? 'numeric' : 'text'} maxLength={kind === 'oib' ? 11 : 30} required onChange={(e) => { setValue(e.target.value); reset(); }} />
            </div>
          </div>
          {result && result.ima_pravo && (
            <p className="notice">
              {T('Pravo na povlašteni prijevoz je potvrđeno.')}
              {result.otok ? ` ${T('Otok')}: ${result.otok}.` : ''}
              <br /><strong>{T('Cijena karte')}: {money(unit)}</strong>
            </p>
          )}
          {result && !result.ima_pravo && (
            <p className="error" role="alert">{result.poruka || result.razlog || T('Iskaznica nema pravo na povlašteni prijevoz.')}</p>
          )}
          {error && <p className="error" role="alert">{T(error)}</p>}
        </div>
        <div className="island-actions">
          <button type="button" className="back" onClick={onClose}>{T('Zatvori')}</button>
          {result?.ima_pravo
            ? <button type="button" className="primary" onClick={add}>{T('Dodaj otočnu kartu')}</button>
            : <button className="primary" disabled={!valid || checking}>{T(checking ? 'Provjeravam…' : 'Provjeri pravo')}</button>}
        </div>
      </form>
    </dialog>
  );
}
