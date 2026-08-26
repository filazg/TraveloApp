import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { resolveBackendUrl } from "../../helpers/backendUrl"

const backendURL = resolveBackendUrl('/app')

const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrapBff = (resp) => resp.data?.data?.data ?? resp.data?.data ?? resp.data;

export const fetchDispSailingsThunk = createAsyncThunk(
    "dispatcher/fetchSailings",
    async (departure_date, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/sailing/sailings", {
                params: { departure_date, include: "legs,bookings" },
            });
            const payload = unwrapBff(resp);
            const list = Array.isArray(payload) ? payload : payload?.sailings || [];
            return list;
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

export const fetchDispCategoriesThunk = createAsyncThunk(
    "dispatcher/fetchCategories",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/booking/capacity_categories");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.categories || [];
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

// Keep old name as alias so existing imports keep working during transition.
export const fetchDispRoutesThunk = fetchDispSailingsThunk;

// Vracanje pogresno otkazanog polaska u prodaju. Karte ostaju otkazane, pa
// odgovor javlja koliko ih je — polazak se vraca prazan.
export const restoreSailingThunk = createAsyncThunk("dispatcher/restoreSailing", async (payload, { rejectWithValue }) => {
    try {
        const resp = await api.post("/portal/dispatcher/restore_sailing", payload);
        const body = resp.data?.data ?? resp.data ?? {};
        return body;
    } catch (err) { return rejectWithValue(err.response?.data?.data || { message: err.message }); }
});
export const cancelSailingThunk = createAsyncThunk("dispatcher/cancelSailing", async (payload, { rejectWithValue }) => {
    try {
        const resp = await api.post("/portal/dispatcher/cancel_sailing", payload);
        const body = resp.data?.data ?? resp.data ?? {};
        return body;
    } catch (err) { return rejectWithValue(err.response?.data?.data || { message: err.message }); }
});

// Plovila za dropdown u dijalogu za zamjenu broda.
export const fetchDispBoatsThunk = createAsyncThunk(
    "dispatcher/fetchBoats",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/boat/boats");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.boats || [];
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

// Zamjena plovila na jednom polasku. Backend prepiše plovilo i bazne kapacitete
// na svim legovima tog voyage-a pa prekalkulira booking kapacitete.
export const changeSailingBoatThunk = createAsyncThunk("dispatcher/changeBoat", async (payload, { rejectWithValue }) => {
    try {
        const resp = await api.post("/portal/dispatcher/change_boat", payload);
        const body = resp.data?.data ?? resp.data ?? {};
        return body;
    } catch (err) { return rejectWithValue(err.response?.data?.data || { message: err.message }); }
});

export const sendSailingMessageThunk = createAsyncThunk("dispatcher/sendMessage", async (payload, { rejectWithValue }) => {
    try {
        const resp = await api.post("/portal/dispatcher/send_sailing_message", payload);
        const body = resp.data?.data ?? resp.data ?? {};
        return body;
    } catch (err) { return rejectWithValue(err.response?.data?.data || { message: err.message }); }
});

const dispatcherSlice = createSlice({
    name: "dispatcher",
    initialState: {
        sailings: [],
        categories: [],
        boats: [],
        loading: false,
        error: null,
        filter: { travel_date: new Date().toISOString().slice(0, 10) },
        actionLoading: false,
        actionResult: null,
    },
    reducers: {
        setDispatcherFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.filter[path] = value;
        },
        clearActionResult(state) { state.actionResult = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDispSailingsThunk.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchDispSailingsThunk.fulfilled, (s, a) => { s.loading = false; s.sailings = a.payload || []; })
            .addCase(fetchDispSailingsThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || "Greška"; })
            .addCase(fetchDispCategoriesThunk.fulfilled, (s, a) => { s.categories = a.payload || []; })
            .addCase(cancelSailingThunk.pending, (s) => { s.actionLoading = true; })
            .addCase(cancelSailingThunk.fulfilled, (s, a) => { s.actionLoading = false; s.actionResult = a.payload; })
            .addCase(cancelSailingThunk.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload?.message; })
            .addCase(restoreSailingThunk.pending, (s) => { s.actionLoading = true; })
            .addCase(restoreSailingThunk.fulfilled, (s, a) => { s.actionLoading = false; s.actionResult = a.payload; })
            .addCase(restoreSailingThunk.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload?.message; })
            .addCase(sendSailingMessageThunk.pending, (s) => { s.actionLoading = true; })
            .addCase(sendSailingMessageThunk.fulfilled, (s, a) => { s.actionLoading = false; s.actionResult = a.payload; })
            .addCase(sendSailingMessageThunk.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload?.message; })
            .addCase(fetchDispBoatsThunk.fulfilled, (s, a) => { s.boats = a.payload || []; })
            .addCase(changeSailingBoatThunk.pending, (s) => { s.actionLoading = true; })
            .addCase(changeSailingBoatThunk.fulfilled, (s, a) => { s.actionLoading = false; s.actionResult = a.payload; })
            .addCase(changeSailingBoatThunk.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload?.message; });
    },
});

export const { setDispatcherFilter, clearActionResult } = dispatcherSlice.actions;
export const dispatcherSliceData = (state) => state.dispatcher;
export default dispatcherSlice.reducer;
