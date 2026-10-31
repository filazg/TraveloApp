// Pozivi prema web-sales-servisu. Isti backend kao stara web prodaja
// (travelo-web-sales); razlika je samo da plaćanje pokreće server.
//
// Adresa: VITE_WEB_SALES_URL ako je zadan; na poslužitelju origin stranice +
// /web_sale (nginx ondje vrti servis); lokalno izravno servis na :6030.
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

const resolveUrl = () => {
  const fromEnv = import.meta.env?.VITE_WEB_SALES_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location && !LOCAL_HOSTS.includes(window.location.hostname)) {
    return `${window.location.origin}/web_sale`;
  }
  return 'http://localhost:6030';
};

export const url = resolveUrl();

// Servis greške vraća kao { status, data: { message } }; poruka ide kupcu.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const request = async (path, { method = 'GET', body } = {}) => {
  let resp;
  try {
    resp = await fetch(`${url}/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Veza s poslužiteljem nije uspjela. Pokušajte ponovno.', 0);
  }
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || (json?.status && json.status >= 400)) {
    throw new ApiError(json?.data?.message || json?.message || `Greška ${resp.status}`, resp.status);
  }
  return json;
};

export const getHarbors = async () => {
  const json = await request('harbors');
  return (json?.data?.harbors || []).filter((h) => h.is_active !== false);
};

// date: YYYY-MM-DD. Servis traži cijele objekte luka (koristi code).
export const searchTrips = async (from, to, date) => {
  const json = await request('search_trips', {
    method: 'POST',
    body: { travel_from: from, travel_to: to, travel_date: `${date} 00:00` },
  });
  return json?.data?.trips || [];
};

// kind: card_no | oib | iks
export const checkIslandCard = async (kind, value, trip) => {
  const json = await request('check_island_card', {
    method: 'POST',
    body: {
      [kind]: value,
      route: {
        line_no: trip.line_code,
        departure_harbor_code: trip.departure_harbor_id,
        arrival_harbor_code: trip.arrival_harbor_id,
      },
      date: trip.departure,
    },
  });
  return json?.data || json;
};

export const sudregLookup = async (oib) => {
  const json = await request(`sudreg?oib=${encodeURIComponent(oib)}`);
  return json || {};
};

// Izrađuje narudžbe i vraća payment_url na Monri.
export const confirmOrder = async ({ data, order_number, buyer_data, language }) => {
  const json = await request('order_confirmation', {
    method: 'POST',
    body: { data, order_number, buyer_data, language, init_payment: true },
  });
  return json?.data || {};
};

export const ordersByReference = async (payment_reference) => {
  const json = await request(`orders_by_reference?payment_reference=${encodeURIComponent(payment_reference)}`);
  const data = json?.data ?? json;
  return Array.isArray(data?.orders) ? data.orders : [];
};

export const ticketsPdfUrl = (orderUuids) => `${url}/tickets_pdf?order_uuids=${encodeURIComponent(orderUuids.join(','))}`;
export const invoicePdfUrl = (invoiceUuid) => `${url}/invoice_pdf/${invoiceUuid}`;
