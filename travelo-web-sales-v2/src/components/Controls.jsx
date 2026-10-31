import React, { useEffect, useRef, useState } from 'react';

export function Chevron() {
  return <svg className="field-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>;
}

export function Check() {
  return <span className="geometric-check" aria-hidden="true" />;
}

// Odabir luke. harbors i value su objekti iz /harbors; luka odabrana na drugoj
// strani se ne nudi.
export function PortPicker({ label, placeholder, harbors, value, onChange, locked, T, otherPort }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const button = useRef(null);

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const moveFocus = (e) => {
    if (e.key === 'Escape') { setOpen(false); button.current?.focus(); }
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const items = [...ref.current.querySelectorAll('[role=option]:not(:disabled)')];
      const n = items.indexOf(e.currentTarget);
      items[(n + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  };

  return (
    <div ref={ref} className="destination-wrap">
      <label>{T(label)}</label>
      {locked ? (
        <div className="locked-destination"><span>{value?.name}</span><span aria-label={T('Povratak')}>▣</span></div>
      ) : (
        <>
          <button
            ref={button}
            className="destination-button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
                setTimeout(() => ref.current?.querySelector('[role=option]:not(:disabled)')?.focus(), 0);
              }
            }}
          >
            {value?.name || T(placeholder)}<Chevron />
          </button>
          {open && (
            <div className="destination-list" role="listbox" aria-label={T(label)}>
              {harbors.map((h) => {
                const disabled = otherPort?.code === h.code;
                return (
                  <button
                    role="option"
                    key={h.code}
                    disabled={disabled}
                    aria-disabled={disabled}
                    aria-selected={value?.code === h.code}
                    className="destination-option"
                    onClick={() => { onChange(h); setOpen(false); button.current?.focus(); }}
                    onKeyDown={moveFocus}
                  >
                    <span className="option-mark"><Check /></span>{h.name}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Calendar({ date, min, title, onChoose, onClose, T, locale }) {
  const ref = useRef();
  const [month, setMonth] = useState(new Date((date || min) + 'T12:00:00'));
  const [picked, setPicked] = useState(date);
  useEffect(() => { ref.current.showModal(); }, []);

  const y = month.getFullYear(), m = month.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const iso = (n) => `${y}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;

  return (
    <dialog ref={ref} className="calendar-dialog" onCancel={onClose}>
      <div className="calendar-head">
        <h2>{T(title)}</h2>
        <button className="cal-close" onClick={onClose} aria-label={T('Zatvori kalendar')}>×</button>
      </div>
      <div className="month-nav">
        <button disabled={`${y}-${String(m + 1).padStart(2, '0')}` <= min.slice(0, 7)} onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label={T('Prethodni mjesec')}>‹</button>
        <strong>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</strong>
        <button onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label={T('Sljedeći mjesec')}>›</button>
      </div>
      <div className="cal-grid">
        {Array.from({ length: 7 }, (_, i) => <span className="cal-week" key={'w' + i}>{new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'short' })}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={'empty' + i} />)}
        {Array.from({ length: days }, (_, i) => (
          <button key={i} className={'cal-day ' + (picked === iso(i + 1) ? 'selected' : '')} disabled={iso(i + 1) < min} aria-pressed={picked === iso(i + 1)} onClick={() => setPicked(iso(i + 1))}>{i + 1}</button>
        ))}
      </div>
      <div className="cal-footer">
        <span>{picked}</span>
        <button className="primary" disabled={!picked} onClick={() => { onChoose(picked); onClose(); }}>{T('Odaberi datum')} →</button>
      </div>
    </dialog>
  );
}
