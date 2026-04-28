import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client';
import { ENDPOINTS } from '../../api/config';
import { upsertExternalTickets, loadTicketsForRoutes, markTicketValidatedLocal, findTicketByUuidOrCode } from '../../db/repo';

// Karte polaska — module-level Map, IZVAN Redux-a. SerializableStateInvariantMiddleware
// inače serijalizira cijeli state na svaki dispatch što s nekoliko stotina karata
// blokira JS thread 250ms+ i RN bridge crasha.
const _voyageTicketsByUuid = new Map();
export const setVoyageTicketsCache = (tickets) => {
    _voyageTicketsByUuid.clear();
    for (const t of tickets || []) {
        if (t?.ticket_uuid) _voyageTicketsByUuid.set(t.ticket_uuid, t);
        if (t?.ticket_code) _voyageTicketsByUuid.set(t.ticket_code, t);
    }
};
export const getCachedTicket = (key) => _voyageTicketsByUuid.get(key) || null;
export const updateCachedTicket = (uuid, patch) => {
    const cur = _voyageTicketsByUuid.get(uuid);
    if (cur) _voyageTicketsByUuid.set(uuid, { ...cur, ...patch });
};
export const cachedTicketCount = () => {
    // Map sadrži dvije zapise po karti (uuid + code) — vrati približan broj.
    return Math.ceil(_voyageTicketsByUuid.size / 2);
};

// Dodaj karte u postojeći cache bez brisanja (npr. nakon lokalne prodaje).
// Prolaze kroz sanitizeTicket da sve relevantna polja budu prisutna (order_uuid,
// departure_harbor_id itd.) — bez toga findRelatedTickets i harbor check ne rade.
export const addTicketsToCache = (tickets) => {
    for (const t of tickets || []) {
        const s = sanitizeTicket(t);
        if (!s?.ticket_uuid) continue;
        _voyageTicketsByUuid.set(s.ticket_uuid, s);
        if (s.ticket_code) _voyageTicketsByUuid.set(s.ticket_code, s);
    }
};

// Lista svih unique karata u cache-u (Map ima dupli zapis po uuid i code).
export const listCachedTickets = () => {
    const seen = new Set();
    const out = [];
    for (const t of _voyageTicketsByUuid.values()) {
        if (!t?.ticket_uuid || seen.has(t.ticket_uuid)) continue;
        seen.add(t.ticket_uuid);
        out.push(t);
    }
    return out;
};

// Broj validiranih karata u cache-u.
export const countCachedValidated = () => {
    let n = 0;
    for (const t of listCachedTickets()) {
        if (t.status === 'validated' || t.validate_data) n += 1;
    }
    return n;
};

// Nađi sve NEVALIDIRANE karte iz iste narudžbe (order_uuid) — isključujući main.
// Koristi se za "validate related tickets" flow nakon scan-a jedne karte.
export const findRelatedTickets = (orderUuid, excludeTicketUuid) => {
    if (!orderUuid) return [];
    const seen = new Set();
    const out = [];
    for (const t of _voyageTicketsByUuid.values()) {
        if (!t || seen.has(t.ticket_uuid)) continue;
        seen.add(t.ticket_uuid);
        if (t.ticket_uuid === excludeTicketUuid) continue;
        if (t.order_uuid !== orderUuid) continue;
        if (t.is_canceled) continue;
        if (t.status === 'validated' || t.validate_data) continue;
        out.push(t);
    }
    return out;
};

// Bekend (Sequelize) može vratiti DECIMAL kao string i Date objekte —
// pretvori sve u primitivne JSON-friendly vrijednosti da Redux state i RN
// render ne pucaju.
const toStr = (v) => (v == null ? '' : String(v));
const sanitizeTicket = (t) => {
    if (!t || typeof t !== 'object') return null;
    return {
        ticket_uuid: toStr(t.ticket_uuid),
        ticket_code: toStr(t.ticket_code),
        order_uuid: toStr(t.order_uuid),
        ticket_type_name: toStr(t.ticket_type_name),
        line_code: toStr(t.line_code),
        line_name: toStr(t.line_name),
        departure_harbor_id: toStr(t.departure_harbor_id),
        departure_harbor_name: toStr(t.departure_harbor_name),
        arrival_harbor_id: toStr(t.arrival_harbor_id),
        arrival_harbor_name: toStr(t.arrival_harbor_name),
        route_uuid: toStr(t.route_uuid),
        departure_planed: toStr(t.departure_planed),
        single_price: Number(t.single_price) || 0,
        status: toStr(t.status),
        validate_data: t.validate_data ? toStr(t.validate_data) : null,
        is_canceled: Boolean(t.is_canceled),
    };
};

// Pretvori "DD/MM/YYYY" u "YYYY-MM-DD" (backend filter podržava oba).
const dmyToIso = (dmy) => {
    if (!dmy) return null;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dmy));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(dmy);
};

// Povuci sve karte za odabrani polazak (svi prodajni kanali) — date + lista route_uuid.
// Drži ih i u Redux state-u kako bi scan lookup bio in-memory (SQLite read u scan
// putu je zabrinjavajuće sporo i krašio je app pod opterećenjem upserta).
export const fetchVoyageTicketsThunk = createAsyncThunk(
    'validation/fetchVoyageTickets',
    async ({ date, routeUuids }, { rejectWithValue }) => {
        try {
            const resp = await api.get(ENDPOINTS.voyageTickets, {
                params: {
                    date: dmyToIso(date) || date,
                    route_uuids: Array.isArray(routeUuids) ? routeUuids.join(',') : routeUuids,
                    limit: 5000,
                },
                timeout: 15000,
            });
            const body = resp.data?.data ?? resp.data ?? {};
            const tickets = Array.isArray(body.tickets) ? body.tickets : [];
            // SQLite upsert je best-effort (offline fallback ali ne blokira validaciju).
            try { await upsertExternalTickets(tickets); } catch (e) {
                console.log('[fetchVoyageTickets] SQLite upsert failed:', e?.message || e);
            }
            // Sanitiziraj sve karte i spremi u module-level cache (NE u Redux state).
            const sanitized = tickets.map(sanitizeTicket).filter(Boolean);
            setVoyageTicketsCache(sanitized);
            return { count: sanitized.length, fetchedAt: new Date().toISOString() };
        } catch (err) {
            return rejectWithValue({ message: err?.message || 'Sync karata nije uspio' });
        }
    }
);

// Učitaj karte iz lokalne baze za dane rute (offline-friendly).
export const loadLocalVoyageTicketsThunk = createAsyncThunk(
    'validation/loadLocalVoyageTickets',
    async ({ routeUuids }) => {
        const tickets = await loadTicketsForRoutes(routeUuids || []);
        return { tickets };
    }
);

// Scan QR → module-cache lookup → backend POST (fire-and-forget).
export const validateScanThunk = createAsyncThunk(
    'validation/validateScan',
    async ({ scanned, terminalUuid, operator }, { rejectWithValue }) => {
        try {
            const ticketUuid = String(scanned || '').split(';')[0].trim();
            console.log('[validateScan] start uuid=', ticketUuid);
            if (!ticketUuid) return rejectWithValue({ message: 'Prazan kod.' });

            const local = getCachedTicket(ticketUuid);
            console.log('[validateScan] local found in cache:', !!local);
            if (!local) {
                return rejectWithValue({
                    message: 'Karta nije pronađena za ovaj polazak.',
                    code: 'NOT_FOUND',
                });
            }
            if (local.is_canceled) {
                return rejectWithValue({ message: 'Karta je stornirana.', code: 'CANCELED', ticket: local });
            }
            if (local.status === 'validated' || local.validate_data) {
                console.log('[validateScan] already validated');
                return {
                    ok: true,
                    already: true,
                    ticket: local,
                    validated_at: local.validate_data,
                    message: 'Karta je već validirana.',
                };
            }

            const now = new Date().toISOString();
            // Backend POST — POTPUNO non-blocking (fire-and-forget). Sve handlere u
            // .then/.catch da iznimka iz axiosa NIKAD ne propada do thunka.
            console.log('[validateScan] POST to backend (fire-and-forget)');
            try {
                api.post(
                    ENDPOINTS.validateTicket,
                    { ticket_uuid: local.ticket_uuid, terminal_uuid: terminalUuid, operator },
                    { timeout: 8000 }
                )
                    .then(() => console.log('[validateScan] backend OK'))
                    .catch((e) => console.log('[validateScan] backend POST failed:', e?.message || e));
            } catch (e) {
                console.log('[validateScan] POST sync error:', e?.message || e);
            }

            // SQLite mark — best-effort, isto fire-and-forget.
            try {
                markTicketValidatedLocal(local.ticket_uuid, now).catch((e) =>
                    console.log('[validateScan] SQLite mark failed:', e?.message || e)
                );
            } catch (e) {
                console.log('[validateScan] SQLite sync error:', e?.message || e);
            }

            console.log('[validateScan] returning fulfilled');
            return {
                ok: true,
                ticket: { ...local, status: 'validated', validate_data: now },
                validated_at: now,
            };
        } catch (err) {
            console.warn('[validateScan] caught error:', err?.message || err);
            return rejectWithValue({ message: err?.message || 'Validacija nije uspjela.' });
        }
    },
    {
        // Spriječi paralelne dispatcheve (Sunmi scanner triggera 3-4× po pritisku).
        condition: (_arg, { getState }) => {
            const st = getState().validation;
            return !st.processing;
        },
    }
);

const slice = createSlice({
    name: 'validation',
    initialState: {
        loading: false,
        processing: false,
        lastFetched: null,
        ticketsCount: 0,
        scanResult: null,    // { ok, already, ticket, message, validated_at }
        scanError: null,     // { message, code, ticket? }
    },
    reducers: {
        clearScanResult(state) { state.scanResult = null; state.scanError = null; },
    },
    extraReducers: (b) => {
        b.addCase(fetchVoyageTicketsThunk.pending, (s) => { s.loading = true; });
        b.addCase(fetchVoyageTicketsThunk.fulfilled, (s, a) => {
            s.loading = false;
            s.lastFetched = a.payload.fetchedAt;
            s.ticketsCount = a.payload.count;
        });
        b.addCase(fetchVoyageTicketsThunk.rejected, (s) => { s.loading = false; });
        b.addCase(validateScanThunk.pending, (s) => { s.processing = true; });
        b.addCase(validateScanThunk.fulfilled, (s, a) => {
            s.processing = false;
            s.scanResult = a.payload;
            s.scanError = null;
            // Update cache tako da idući scan iste karte odmah vidi "već validirano".
            if (a.payload?.ticket?.ticket_uuid && !a.payload.already) {
                updateCachedTicket(a.payload.ticket.ticket_uuid, {
                    status: 'validated',
                    validate_data: a.payload.validated_at,
                });
            }
        });
        b.addCase(validateScanThunk.rejected, (s, a) => {
            s.processing = false;
            s.scanResult = null;
            s.scanError = a.payload || { message: 'Greška' };
        });
    },
});

export const { clearScanResult } = slice.actions;
export const validationData = (state) => state.validation;
export default slice.reducer;
