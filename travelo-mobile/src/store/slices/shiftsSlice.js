import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';
import { ENDPOINTS } from '../../api/config';
import {
    saveShiftLocal,
    loadOpenShiftFor,
    loadRecentShifts,
    loadPendingShifts,
    markShiftSynced,
    loadInvoicesForShift,
} from '../../db/repo';

const nowIso = () => new Date().toISOString();
const newUuid = () => {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

// Best-effort POST snapshot smjene backendu. Vraća true ako je prošlo, false inače.
const pushShiftToBackend = async (shift, financeRows = []) => {
    try {
        const payload = {
            shift,
            shift_finance: financeRows,
        };
        const resp = await api.post(ENDPOINTS.shift, payload, { timeout: 8000 });
        return resp?.data?.status === 200;
    } catch (err) {
        // Network/timeout — snapshot ostaje u lokalnoj bazi sa synced=0 i kasnije se push-a.
        return false;
    }
};

// Otvori novu smjenu — generira shift_uuid, sprema lokalno, best-effort push backendu.
export const openShiftThunk = createAsyncThunk(
    'shifts/open',
    async (_, { getState, rejectWithValue }) => {
        const { auth, sync } = getState();
        const operator = auth.operator;
        const basicData = sync.basicData;
        if (!operator) return rejectWithValue({ message: 'Operater nije prijavljen' });
        if (!basicData) return rejectWithValue({ message: 'Osnovni podaci nisu sinkronizirani' });

        const shift = {
            shift_uuid: newUuid(),
            client_uuid: basicData.company_uuid || null,
            client_name: basicData.company_name || null,
            client_oib: basicData.company_oib || null,
            business_premise_uuid: basicData.business_premise_uuid || null,
            business_premise_name: basicData.business_premise_name || null,
            business_premise_fiscal_mark: basicData.business_premise_fiscal_mark || null,
            billing_device_uuid: basicData.billing_device_uuid || null,
            billing_device_fiscal_mark: basicData.billing_device_fiscal_mark || null,
            operater_name: operator.user_name || null,
            operater_surname: operator.user_surname || null,
            operater_username: operator.user_username || null,
            operator_uuid: operator.user_uuid || operator.uuid || null,
            shift_start: nowIso(),
            shift_end: null,
            shift_open: true,
            remark: null,
            shift_first_invoice: null,
            shift_last_invoice: null,
            shift_amount: 0,
            shift_vat_base: 0,
            shift_vat: 0,
            shift_harbor_tax: 0,
        };

        const ok = await pushShiftToBackend(shift, []);
        await saveShiftLocal({
            ...shift,
            opened_at: shift.shift_start,
            closed_at: null,
            synced: ok,
        });
        return { ...shift, _synced: ok };
    }
);

// Pomoćni izračun agregata + breakdown po vrsti plaćanja iz lokalnih invoices.
export const computeShiftBreakdown = (invoices = []) => {
    let amount = 0;
    let vat_base = 0;
    let vat = 0;
    let harbor_tax = 0;
    const byPayment = new Map();
    let firstInvoice = null;
    let lastInvoice = null;

    for (const inv of invoices) {
        const total = Number(inv.total_amount ?? inv.amount ?? 0);
        amount += total;
        vat_base += Number(inv.total_vat_base ?? inv.vat_base ?? 0);
        vat += Number(inv.total_vat ?? inv.vat ?? 0);
        harbor_tax += Number(inv.total_harbor_tax ?? inv.harbor_tax ?? 0);

        const pmUuid = inv.payment_method_uuid || inv.payment_type_uuid || null;
        const pmName = inv.payment_method_name || inv.payment_type_name || 'Nepoznato';
        if (pmUuid) {
            const cur = byPayment.get(pmUuid) || {
                payment_type_uuid: pmUuid,
                payment_type_name: pmName,
                payment_amount: 0,
                count: 0,
            };
            cur.payment_amount += total;
            cur.count += 1;
            byPayment.set(pmUuid, cur);
        }

        const no = inv.invoice_no || inv.invoice_fiskal_no || null;
        if (no) {
            if (!firstInvoice) firstInvoice = no;
            lastInvoice = no;
        }
    }

    const finance = [...byPayment.values()].map((row) => ({
        ...row,
        payment_amount: Number(row.payment_amount.toFixed(2)),
    }));

    return {
        shift_amount: Number(amount.toFixed(2)),
        shift_vat_base: Number(vat_base.toFixed(2)),
        shift_vat: Number(vat.toFixed(2)),
        shift_harbor_tax: Number(harbor_tax.toFixed(2)),
        shift_first_invoice: firstInvoice,
        shift_last_invoice: lastInvoice,
        finance,
    };
};

// Učitaj fakture trenutno otvorene smjene + izračunaj breakdown (za UI prije zatvaranja).
export const previewCloseShiftThunk = createAsyncThunk(
    'shifts/previewClose',
    async (_, { getState }) => {
        const { shifts } = getState();
        const open = shifts.currentOpen;
        if (!open) return null;
        const invoices = await loadInvoicesForShift(open.shift_uuid);
        const breakdown = computeShiftBreakdown(invoices);
        return { invoiceCount: invoices.length, ...breakdown };
    }
);

// Zatvori smjenu — finalizira agregate, snima lokalno, best-effort push.
// `actuals` (opcionalno): map<payment_type_uuid, {actual_amount, note}> — upisani iznos
// brojanog/uplaćenog po vrsti plaćanja (manjak/višak ide u remark).
export const closeShiftThunk = createAsyncThunk(
    'shifts/close',
    async ({ remark, actuals } = {}, { getState, rejectWithValue }) => {
        const { shifts } = getState();
        const open = shifts.currentOpen;
        if (!open) return rejectWithValue({ message: 'Nema otvorene smjene' });

        const invoices = await loadInvoicesForShift(open.shift_uuid);
        const breakdown = computeShiftBreakdown(invoices);

        const financeRows = breakdown.finance.map((row) => {
            const actual = actuals?.[row.payment_type_uuid];
            return {
                shift_financ_uuid: newUuid(),
                shift_uuid: open.shift_uuid,
                payment_type_uuid: row.payment_type_uuid,
                payment_type_name: row.payment_type_name,
                payment_amount: row.payment_amount,
                actual_amount: actual?.actual_amount ?? null,
                actual_note: actual?.note ?? null,
            };
        });

        const closed = {
            ...open,
            shift_end: nowIso(),
            shift_open: false,
            shift_amount: breakdown.shift_amount,
            shift_vat_base: breakdown.shift_vat_base,
            shift_vat: breakdown.shift_vat,
            shift_harbor_tax: breakdown.shift_harbor_tax,
            shift_first_invoice: breakdown.shift_first_invoice,
            shift_last_invoice: breakdown.shift_last_invoice,
            remark: remark || null,
            shift_finance: financeRows,
        };

        const ok = await pushShiftToBackend(closed, financeRows);
        await saveShiftLocal({
            ...closed,
            opened_at: closed.shift_start,
            closed_at: closed.shift_end,
            operator_uuid: open.operator_uuid,
            synced: ok,
        });
        return { ...closed, _synced: ok };
    }
);

// Učitaj otvorenu smjenu za trenutnog operatera (na boot-u i nakon login-a).
export const loadCurrentOpenThunk = createAsyncThunk(
    'shifts/loadCurrentOpen',
    async (_, { getState }) => {
        const { auth, sync } = getState();
        const operatorUuid = auth.operator?.user_uuid || auth.operator?.uuid;
        const billingDeviceUuid = sync.basicData?.billing_device_uuid;
        if (!operatorUuid) return null;
        return loadOpenShiftFor(operatorUuid, billingDeviceUuid);
    }
);

export const loadRecentShiftsThunk = createAsyncThunk(
    'shifts/loadRecent',
    async (_, { getState }) => {
        const { auth } = getState();
        const operatorUuid = auth.operator?.user_uuid || auth.operator?.uuid;
        return loadRecentShifts(operatorUuid, 30);
    }
);

// Push svih synced=0 smjena backendu. Zove se kad se konekcija vrati.
export const syncPendingShiftsThunk = createAsyncThunk(
    'shifts/syncPending',
    async () => {
        const pending = await loadPendingShifts();
        let pushed = 0;
        for (const shift of pending) {
            const finance = shift.shift_finance || [];
            const ok = await pushShiftToBackend(shift, finance);
            if (ok) {
                await markShiftSynced(shift.shift_uuid);
                pushed += 1;
            } else {
                // Network failure — abort to retry later.
                break;
            }
        }
        return { pushed, remaining: (await loadPendingShifts()).length };
    }
);

const shiftsSlice = createSlice({
    name: 'shifts',
    initialState: {
        currentOpen: null,
        recent: [],
        preview: null, // { invoiceCount, shift_amount, shift_vat, shift_vat_base, shift_harbor_tax, finance: [...] }
        loading: false,
        error: null,
        pendingCount: 0,
    },
    reducers: {
        clearShiftsError(state) { state.error = null; },
        clearShiftPreview(state) { state.preview = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(openShiftThunk.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(openShiftThunk.fulfilled, (s, a) => {
                s.loading = false;
                s.currentOpen = a.payload;
                if (!a.payload._synced) s.pendingCount += 1;
            })
            .addCase(openShiftThunk.rejected, (s, a) => {
                s.loading = false;
                s.error = a.payload?.message || 'Otvaranje smjene nije uspjelo';
            })
            .addCase(closeShiftThunk.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(closeShiftThunk.fulfilled, (s, a) => {
                s.loading = false;
                s.currentOpen = null;
                s.preview = null;
                s.recent = [a.payload, ...s.recent.filter((r) => r.shift_uuid !== a.payload.shift_uuid)].slice(0, 30);
                if (!a.payload._synced) s.pendingCount += 1;
            })
            .addCase(closeShiftThunk.rejected, (s, a) => {
                s.loading = false;
                s.error = a.payload?.message || 'Zatvaranje smjene nije uspjelo';
            })
            .addCase(loadCurrentOpenThunk.fulfilled, (s, a) => {
                s.currentOpen = a.payload || null;
            })
            .addCase(loadRecentShiftsThunk.fulfilled, (s, a) => {
                s.recent = a.payload || [];
            })
            .addCase(previewCloseShiftThunk.fulfilled, (s, a) => {
                s.preview = a.payload;
            })
            .addCase(syncPendingShiftsThunk.fulfilled, (s, a) => {
                s.pendingCount = a.payload?.remaining ?? 0;
            });
    },
});

export const { clearShiftsError, clearShiftPreview } = shiftsSlice.actions;
export const shiftsData = (state) => state.shifts;
export default shiftsSlice.reducer;
