import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';
import { ENDPOINTS } from '../../api/config';
import { saveBasicData, saveTransportData, loadBasicData, loadTransportData, upsertBuyersFromSync } from '../../db/repo';
import { getSetting, setSetting } from '../../db/db';

// Load all persisted data from SQLite into redux on app boot.
export const hydrateFromDbThunk = createAsyncThunk(
    'sync/hydrate',
    async () => {
        const [b, t] = await Promise.all([loadBasicData(), loadTransportData()]);
        return {
            basicData: b.basicData,
            users: b.users,
            paymentMethods: b.paymentMethods,
            harbors: t.harbors,
            lines: t.lines,
            salesRoutes: t.salesRoutes,
            tripsPrices: t.tripsPrices,
        };
    }
);

// Pulls basic_data and persists to SQLite.
export const syncBasicDataThunk = createAsyncThunk(
    'sync/basicData',
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get(ENDPOINTS.basicData);
            const payload = resp.data?.data ?? resp.data ?? {};
            // 7pay konfiguracija stize uz basic_data kao zaseban kljuc; drzimo je
            // unutar basic_data objekta da je prodajni ekran ima na jednom mjestu.
            // Postotci storniranja stižu uz basic_data kao zaseban ključ; drže se
            // unutar basic_data objekta jer se on sprema u SQLite, pa terminal ima
            // ponuđene postotke i bez mreže.
            const basic = payload.basic_data
                ? {
                    ...payload.basic_data,
                    payment_7pay: payload.payment_7pay || null,
                    storno_percentages: payload.storno_percentages || [],
                }
                : null;
            await saveBasicData(
                basic,
                payload.users || [],
                payload.payment_method || []
            );
            // Vracamo dopunjeni basic_data — reducer sprema bas njega u store, pa
            // bi inace 7pay konfiguracija postojala u bazi, a nedostajala u
            // aplikaciji do prvog ponovnog pokretanja.
            return { ...payload, basic_data: basic };
        } catch (err) {
            return rejectWithValue({ message: err.response?.data?.msg || err.message });
        }
    }
);

// Pulls transport_data and persists to SQLite.
export const syncTransportDataThunk = createAsyncThunk(
    'sync/transportData',
    async (_, { rejectWithValue }) => {
        try {
            // `lean=1` — bez proslih polazaka i bez polja koja terminal ne
            // koristi; paket padne s ~4 MB na ~2 MB. `v` je otisak zadnjeg
            // preuzetog plovidbenog reda: ako se nista nije promijenilo, posluzitelj
            // vrati samo potvrdu i uredaj preskoci upis od nekoliko tisuca
            // redaka. Plovidbeni red se mijenja rijetko, a osvjezava cesto.
            const zadnjaVerzija = await getSetting('transport_version');
            const resp = await api.get(ENDPOINTS.transportData, {
                params: { lean: 1, ...(zadnjaVerzija ? { v: zadnjaVerzija } : {}) },
            });
            const payload = resp.data?.data ?? resp.data ?? {};
            if (payload.unchanged) {
                return { unchanged: true };
            }
            // Nepotpun odgovor se ne sprema. Inace bi `|| []` obrisalo lokalni
            // plovidbeni red i ostavilo uredaj bez ijednog polaska.
            if (!Array.isArray(payload.lines) || !Array.isArray(payload.sales_routes)) {
                return rejectWithValue({ message: 'Plovidbeni red nije stigao u cijelosti' });
            }
            await saveTransportData({
                harbors: payload.harbors || [],
                lines: payload.lines || [],
                salesRoutes: payload.sales_routes || [],
                tripsPrices: payload.trips_prices || [],
            });
            if (payload.version) await setSetting('transport_version', payload.version);
            return payload;
        } catch (err) {
            return rejectWithValue({ message: err.response?.data?.msg || err.message });
        }
    }
);

// Sync adresara kupaca iz backend invoices — popunjava lokalnu buyers tablicu.
export const syncBuyersThunk = createAsyncThunk(
    'sync/buyers',
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get(ENDPOINTS.buyers, { params: { limit: 500 }, timeout: 15000 });
            const payload = resp.data?.data ?? resp.data ?? {};
            const count = await upsertBuyersFromSync(payload.buyers || []);
            return { count, total: payload.total || count };
        } catch (err) {
            return rejectWithValue({ message: err.response?.data?.msg || err.message });
        }
    }
);

export const syncAllThunk = createAsyncThunk(
    'sync/all',
    async (_, { dispatch }) => {
        await Promise.all([
            dispatch(syncBasicDataThunk()),
            dispatch(syncTransportDataThunk()),
            dispatch(syncBuyersThunk()),
        ]);
        return true;
    }
);

const syncSlice = createSlice({
    name: 'sync',
    initialState: {
        basicData: null,
        users: [],
        paymentMethods: [],
        harbors: [],
        lines: [],
        salesRoutes: [],
        tripsPrices: [],
        loading: false,
        transportLoading: false,
        hydrated: false,
        lastSyncAt: null,
        error: null,
    },
    reducers: {
        clearSync(state) {
            state.basicData = null;
            state.users = [];
            state.paymentMethods = [];
            state.harbors = [];
            state.lines = [];
            state.salesRoutes = [];
            state.tripsPrices = [];
            state.lastSyncAt = null;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(hydrateFromDbThunk.fulfilled, (s, a) => {
                const p = a.payload || {};
                if (p.basicData) s.basicData = p.basicData;
                if (Array.isArray(p.users) && p.users.length) s.users = p.users;
                if (Array.isArray(p.paymentMethods) && p.paymentMethods.length) s.paymentMethods = p.paymentMethods;
                if (Array.isArray(p.harbors) && p.harbors.length) s.harbors = p.harbors;
                if (Array.isArray(p.lines) && p.lines.length) s.lines = p.lines;
                if (Array.isArray(p.salesRoutes) && p.salesRoutes.length) s.salesRoutes = p.salesRoutes;
                if (Array.isArray(p.tripsPrices) && p.tripsPrices.length) s.tripsPrices = p.tripsPrices;
                s.hydrated = true;
            })
            .addCase(syncBasicDataThunk.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(syncBasicDataThunk.fulfilled, (s, a) => {
                s.loading = false;
                s.basicData = a.payload?.basic_data || s.basicData;
                s.users = a.payload?.users || s.users;
                s.paymentMethods = a.payload?.payment_method || s.paymentMethods;
                s.lastSyncAt = new Date().toISOString();
            })
            .addCase(syncBasicDataThunk.rejected, (s, a) => {
                s.loading = false;
                s.error = a.payload?.message || 'Sync greška';
            })
            .addCase(syncTransportDataThunk.pending, (s) => { s.transportLoading = true; })
            .addCase(syncTransportDataThunk.fulfilled, (s, a) => {
                s.transportLoading = false;
                s.harbors = a.payload?.harbors || s.harbors;
                s.lines = a.payload?.lines || s.lines;
                s.salesRoutes = a.payload?.sales_routes || s.salesRoutes;
                s.tripsPrices = a.payload?.trips_prices || s.tripsPrices;
                s.lastSyncAt = new Date().toISOString();
            })
            .addCase(syncTransportDataThunk.rejected, (s, a) => {
                s.transportLoading = false;
                s.error = a.payload?.message || 'Transport sync greška';
            });
    },
});

export const { clearSync } = syncSlice.actions;
export const syncData = (state) => state.sync;
export default syncSlice.reducer;
