import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';
import { ENDPOINTS } from '../../api/config';
import { saveSale, loadPendingInvoices, countPendingInvoices, markInvoiceSynced, pruneOldSyncedInvoices, loadInvoices, loadTicketsForInvoice } from '../../db/repo';
import { buildLocalSale } from '../localSale';

const persistSale = async (saleResp, payload) => {
    const shiftUuid = payload._shift_uuid || saleResp.shift_uuid || null;
    await saveSale({
        invoice: {
            invoice_uuid: saleResp.invoice_uuid,
            order_uuid: saleResp.order_uuid,
            shift_uuid: shiftUuid,
            operator_uuid: payload.operator?.uuid || null,
            voyage_key: payload._voyageKey || null,
            amount: Number(saleResp.total_amount) || 0,
            total_amount: Number(saleResp.total_amount) || 0,
            total_vat_base: Number(saleResp.total_vat_base ?? saleResp.vat_base ?? 0) || 0,
            total_vat: Number(saleResp.total_vat ?? saleResp.vat ?? 0) || 0,
            total_harbor_tax: Number(saleResp.total_harbor_tax ?? saleResp.harbor_tax ?? 0) || 0,
            payment_method_uuid: payload.payment_method_uuid || saleResp.payment_method_uuid || null,
            payment_method_name: payload._payment_method_name || saleResp.payment_method_name || null,
            invoice_no: saleResp.invoice_no || saleResp.invoice_fiskal_no || null,
            created_at: new Date().toISOString(),
            synced: saleResp._local ? 0 : 1,
            raw_response: saleResp,
            cart: payload.items,
            local: !!saleResp._local,
        },
        tickets: (saleResp.tickets || []).map((t) => ({
            ...t,
            invoice_uuid: saleResp.invoice_uuid,
            order_uuid: saleResp.order_uuid,
            shift_uuid: shiftUuid,
            created_at: new Date().toISOString(),
        })),
    });
};

// Try backend first; on network error or timeout, fall back to local generation
// so the operator can keep selling tickets without connectivity.
export const finalizeSaleThunk = createAsyncThunk(
    'sales/finalize',
    async (payload, { getState, rejectWithValue }) => {
        // Guard — bez otvorene smjene se ne smije izdati račun.
        const { shifts } = getState();
        if (!shifts?.currentOpen?.shift_uuid) {
            return rejectWithValue({ message: 'Smjena nije otvorena. Otvorite smjenu prije izdavanja računa.' });
        }
        payload._shift_uuid = shifts.currentOpen.shift_uuid;
        // Attempt online sale.
        try {
            const resp = await api.post(ENDPOINTS.finalizeSale, payload, { timeout: 10000 });
            const body = resp.data?.data ?? resp.data ?? {};
            if (body.invoice_uuid) {
                await persistSale(body, payload);
                return body;
            }
            // Backend responded but with an explicit business error (e.g. overbooking) — DO NOT fall back.
            if (body?.message) {
                return rejectWithValue({ message: body.message });
            }
            // Unknown shape — treat as failure with offline fallback below.
        } catch (err) {
            // Real network/timeout error: fall through to offline mode.
            console.log('Backend sale failed, falling back to offline:', err?.message || err);
        }

        // Offline fallback: generate locally + save with synced=0.
        const { sync } = getState();
        const local = await buildLocalSale({
            items: payload.items,
            terminal_uuid: payload.terminal_uuid,
            payment_method_uuid: payload.payment_method_uuid,
            operator: payload.operator,
            basicData: sync.basicData,
            paymentMethods: sync.paymentMethods,
        });
        await persistSale(local, payload);
        return local;
    }
);

// Pushes any locally-generated (synced=0) sales to the backend. Called manually
// or right after a successful online sale.
export const syncPendingSalesThunk = createAsyncThunk(
    'sales/syncPending',
    async (_, { dispatch }) => {
        const pending = await loadPendingInvoices();
        let pushed = 0;
        for (const inv of pending) {
            const cart = inv.cart;
            const operator = inv.raw_response?._localPayload?.operator || {};
            const terminal_uuid = inv.raw_response?._localPayload?.terminal_uuid;
            const payment_method_uuid = inv.raw_response?._localPayload?.payment_method_uuid;
            if (!cart || !terminal_uuid || !payment_method_uuid) continue;
            try {
                const resp = await api.post(ENDPOINTS.finalizeSale, {
                    items: cart,
                    terminal_uuid,
                    payment_method_uuid,
                    operator,
                    buyer: {},
                }, { timeout: 15000 });
                const body = resp.data?.data ?? resp.data ?? {};
                if (body.invoice_uuid) {
                    await markInvoiceSynced(inv.invoice_uuid, body);
                    pushed += 1;
                }
            } catch (e) {
                // First failure aborts the loop — likely still offline.
                break;
            }
        }
        const remaining = await countPendingInvoices();
        // Nakon uspješnog push-a, počisti stare sinkronizirane račune (zadnjih 100).
        try { await pruneOldSyncedInvoices(100); } catch {}
        return { pushed, remaining };
    }
);

export const refreshPendingCountThunk = createAsyncThunk(
    'sales/pendingCount',
    async () => countPendingInvoices()
);

// Vrati zadnjih N računa iz lokalne baze (s _synced flagom za UI badge).
export const loadInvoicesThunk = createAsyncThunk(
    'sales/loadInvoices',
    async (limit = 100) => loadInvoices(limit)
);

// Vrati račun + njegove karte (za detail/reprint).
export const loadInvoiceDetailThunk = createAsyncThunk(
    'sales/loadInvoiceDetail',
    async (invoice_uuid) => {
        const tickets = await loadTicketsForInvoice(invoice_uuid);
        return { invoice_uuid, tickets };
    }
);

const salesSlice = createSlice({
    name: 'sales',
    initialState: {
        finalizing: false,
        lastInvoice: null,
        error: null,
        pendingCount: 0,
        syncing: false,
    },
    reducers: {
        clearLastInvoice(state) { state.lastInvoice = null; },
        clearSalesError(state) { state.error = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(finalizeSaleThunk.pending, (s) => { s.finalizing = true; s.error = null; })
            .addCase(finalizeSaleThunk.fulfilled, (s, a) => {
                s.finalizing = false;
                s.lastInvoice = a.payload;
                if (a.payload?._local) s.pendingCount += 1;
            })
            .addCase(finalizeSaleThunk.rejected, (s, a) => {
                s.finalizing = false;
                s.error = a.payload?.message || 'Izdavanje nije uspjelo';
            })
            .addCase(syncPendingSalesThunk.pending, (s) => { s.syncing = true; })
            .addCase(syncPendingSalesThunk.fulfilled, (s, a) => {
                s.syncing = false;
                s.pendingCount = a.payload.remaining;
            })
            .addCase(syncPendingSalesThunk.rejected, (s) => { s.syncing = false; })
            .addCase(refreshPendingCountThunk.fulfilled, (s, a) => { s.pendingCount = a.payload || 0; });
    },
});

export const { clearLastInvoice, clearSalesError } = salesSlice.actions;
export const salesData = (state) => state.sales;
export default salesSlice.reducer;
