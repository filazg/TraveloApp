import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';
import { ENDPOINTS } from '../../api/config';
import { saveSale, loadPendingInvoices, countPendingInvoices, markInvoiceSynced, pruneOldSyncedInvoices, loadInvoices, loadTicketsForInvoice, loadTicketsByStornoInvoiceUuid } from '../../db/repo';
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
            invoice_total_no: saleResp.invoice_total_no ?? null,
            is_f2: !!saleResp.is_f2,
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

// Numeriranje računa je ISKLJUČIVO lokalno (vidi project_invoice_numbering_rules.md).
// Tijek:
//   1) Sagradimo lokalni račun s lokalnim invoice_no/fiskal_no/invoice_code.
//   2) Pokušamo backend POST kao audit (timeout 10s). Bilo koji invoice_no/uuid
//      iz odgovora SE IGNORIRA — sve fiskalne identifikatore je već dao NU.
//   3) Ako backend prođe → synced=1, ako padne → synced=0 (sync queue ga gura kasnije).
export const finalizeSaleThunk = createAsyncThunk(
    'sales/finalize',
    async (payload, { getState, rejectWithValue }) => {
        // Guard — bez otvorene smjene se ne smije izdati račun.
        const { shifts, sync } = getState();
        if (!shifts?.currentOpen?.shift_uuid) {
            return rejectWithValue({ message: 'Smjena nije otvorena. Otvorite smjenu prije izdavanja računa.' });
        }
        payload._shift_uuid = shifts.currentOpen.shift_uuid;

        // 1) Lokalno generiranje računa — autoritativni izvor brojeva.
        let local;
        try {
            local = await buildLocalSale({
                items: payload.items,
                terminal_uuid: payload.terminal_uuid,
                payment_method_uuid: payload.payment_method_uuid,
                operator: payload.operator,
                buyer: payload.buyer,
                basicData: sync.basicData,
                paymentMethods: sync.paymentMethods,
            });
        } catch (e) {
            console.log('Local sale build failed:', e?.message || e, e?.stack);
            return rejectWithValue({ message: `Generiranje računa: ${e?.message || 'greška'}` });
        }

        // 2) Audit POST — šaljemo i lokalne identifikatore tako da backend zna pod
        // kojim brojem je račun izdan. Odgovor se IGNORIRA u smislu numeriranja.
        let synced = false;
        try {
            const auditPayload = {
                ...payload,
                invoice_uuid: local.invoice_uuid,
                invoice_no: local.invoice_no,
                invoice_year: local.invoice_year,
                invoice_fiskal_no: local.invoice_fiskal_no,
                invoice_total_no: local.invoice_total_no,
                invoice_code: local.invoice_code,
                is_f2: local.is_f2,
                order_uuid: local.order_uuid,
                tickets: local.tickets,
            };
            console.log('[finalizeSale TX]', JSON.stringify({
                endpoint: ENDPOINTS.finalizeSale,
                invoice_uuid: auditPayload.invoice_uuid,
                invoice_no: auditPayload.invoice_no,
                invoice_year: auditPayload.invoice_year,
                invoice_fiskal_no: auditPayload.invoice_fiskal_no,
                invoice_total_no: auditPayload.invoice_total_no,
                invoice_code: auditPayload.invoice_code,
                is_f2: auditPayload.is_f2,
                order_uuid: auditPayload.order_uuid,
                ticket_count: Array.isArray(auditPayload.tickets) ? auditPayload.tickets.length : null,
                first_ticket_uuid: auditPayload.tickets?.[0]?.ticket_uuid,
                first_ticket_code: auditPayload.tickets?.[0]?.ticket_code,
            }));
            const resp = await api.post(ENDPOINTS.finalizeSale, auditPayload, { timeout: 10000 });
            const body = resp.data?.data ?? resp.data ?? {};
            console.log('[finalizeSale RX]', JSON.stringify({
                http_status: resp.status,
                body_invoice_uuid: body?.invoice_uuid,
                body_invoice_no: body?.invoice_no,
                body_invoice_code: body?.invoice_code,
                body_first_ticket_uuid: body?.tickets?.[0]?.ticket_uuid,
            }));
            if (body.invoice_uuid) synced = true;
        } catch (err) {
            console.log('[finalizeSale ERR]', err?.response?.status, err?.response?.data, err?.message);
        }

        // 3) Persist — synced=1 ako je audit prošao, inače 0 (sync će gurati).
        local._local = !synced;
        try {
            await persistSale(local, payload);
        } catch (e) {
            console.log('Persist failed:', e?.message || e);
            return rejectWithValue({ message: `Spremanje: ${e?.message || 'greška'}` });
        }
        return local;
    }
);

// Pushes any locally-generated (synced=0) sales to the backend kao audit push.
// Lokalni invoice_no/uuid/code se šalju s payload-om — backend ne dodjeljuje brojeve.
export const syncPendingSalesThunk = createAsyncThunk(
    'sales/syncPending',
    async (_, { dispatch, getState }) => {
        const pending = await loadPendingInvoices();
        let pushed = 0;
        const skipReasons = [];
        for (const inv of pending) {
            const raw = inv.raw_response || {};

            // STORNO grana — ide na cancelTickets endpoint. _storno_payload je
            // spremio submitStorno za nove storne; za stare (prije fix-a)
            // rekonstruiramo iz inv polja + sync state-a.
            if (inv.is_storno) {
                let sp = inv._storno_payload;
                if (!sp) {
                    const { sync } = getState();
                    const ticket_uuids = await loadTicketsByStornoInvoiceUuid(inv.invoice_uuid);
                    sp = {
                        ticket_uuids,
                        terminal_uuid: sync.basicData?.billing_device_uuid,
                        payment_method_uuid: inv.payment_method_uuid,
                        percentage: inv.storno_percentage || 100,
                        storno_invoice_uuid: inv.invoice_uuid,
                        storno_invoice_no: inv.invoice_no,
                        storno_invoice_code: raw.invoice_code || inv.invoice_code,
                    };
                }
                if (!sp.ticket_uuids?.length || !sp.terminal_uuid) {
                    skipReasons.push(`Storno #${inv.invoice_no || inv.invoice_uuid?.slice(0, 6)}: ${!sp.ticket_uuids?.length ? 'nema ticket_uuids' : ''} ${!sp.terminal_uuid ? 'nema terminal_uuid' : ''}`.trim());
                    continue;
                }
                try {
                    const resp = await api.post(ENDPOINTS.cancelTickets, sp, { timeout: 20000 });
                    const body = resp.data?.data ?? resp.data ?? {};
                    await markInvoiceSynced(inv.invoice_uuid, body);
                    pushed += 1;
                } catch (e) {
                    const status = e?.response?.status || 'NET';
                    const msg = e?.response?.data?.data?.message || e?.response?.data?.message || e?.message || '';
                    skipReasons.push(`Storno #${inv.invoice_no}: HTTP ${status} ${msg}`.trim());
                    break;
                }
                continue;
            }

            // Regularna prodaja — finalizeSale endpoint.
            const cart = inv.cart;
            const operator = raw._localPayload?.operator || {};
            const terminal_uuid = raw._localPayload?.terminal_uuid;
            const payment_method_uuid = raw._localPayload?.payment_method_uuid || inv.payment_method_uuid;
            const buyer = raw._localPayload?.buyer || raw.buyer || {};
            if (!cart || !terminal_uuid || !payment_method_uuid) continue;
            try {
                const resp = await api.post(ENDPOINTS.finalizeSale, {
                    items: cart,
                    terminal_uuid,
                    payment_method_uuid,
                    operator,
                    buyer,
                    invoice_uuid: inv.invoice_uuid,
                    invoice_no: inv.invoice_no,
                    invoice_year: raw.invoice_year,
                    invoice_fiskal_no: raw.invoice_fiskal_no,
                    invoice_total_no: inv.invoice_total_no,
                    invoice_code: raw.invoice_code,
                    is_f2: !!inv.is_f2,
                    order_uuid: raw.order_uuid,
                    tickets: raw.tickets,
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
        return { pushed, remaining, skipReasons };
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
