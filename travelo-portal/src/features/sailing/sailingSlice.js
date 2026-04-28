import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const prod = false;
const backendURL = prod ? "https://bookingtest.krilo.hr/app" : "http://localhost:5100";

const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrapBff = (resp) => resp.data?.data?.data ?? resp.data?.data ?? resp.data;

export const fetchSailingLinesThunk = createAsyncThunk(
    "sailing/fetchLines",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/boat/lines");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.lines || [];
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

export const fetchSailingsThunk = createAsyncThunk(
    "sailing/fetchSailings",
    async ({ line_uuid, departure_date }, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/sailing/sailings", { params: { line_uuid, departure_date } });
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.sailings || [];
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

export const fetchSailingDetailsThunk = createAsyncThunk(
    "sailing/fetchDetails",
    async (uuid, { rejectWithValue }) => {
        try {
            const resp = await api.get(`/portal/sailing/sailings/${uuid}`);
            const payload = unwrapBff(resp);
            return {
                sailing: payload?.sailing || null,
                harbors: payload?.harbors || [],
                legs: payload?.legs || [],
                physical_legs: payload?.physical_legs || [],
                bookings: payload?.bookings || [],
            };
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

export const startSailingThunk = createAsyncThunk(
    "sailing/start",
    async (departure_uuid, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/sailing/start", { departure_uuid });
            return resp.data?.data ?? resp.data ?? {};
        } catch (err) { return rejectWithValue(err.response?.data?.data || { message: err.message }); }
    }
);

export const updateLegStatusThunk = createAsyncThunk(
    "sailing/updateLeg",
    async ({ route_uuid, status, delay_minutes, note }, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/sailing/update_leg", { route_uuid, status, delay_minutes, note });
            return resp.data?.data ?? resp.data ?? {};
        } catch (err) { return rejectWithValue(err.response?.data?.data || { message: err.message }); }
    }
);

// Cancel arrival at a harbor — two-step:
// 1. Mark boat-service leg.arrival_canceled=true + get list of compound route_uuids touching harbor.
// 2. Call dispatcher cancel_sailing with those uuids to refund tickets + send emails.
export const cancelLegThunk = createAsyncThunk(
    "sailing/cancelLeg",
    async ({ route_uuid, cancel_reason }, { rejectWithValue }) => {
        try {
            const cancelResp = await api.post("/portal/sailing/cancel_arrival", { route_uuid, cancel_reason });
            const body = cancelResp.data?.data ?? cancelResp.data ?? {};
            const affected = body.affected_route_uuids || [];
            if (affected.length) {
                await api.post("/portal/dispatcher/cancel_sailing", {
                    route_uuids: affected,
                    cancel_reason,
                    subject: "Kapetan Luka — Stajalište je otkazano",
                    body: cancel_reason
                        ? `Poštovani,\n\nObavještavamo Vas da je stajalište otkazano.\nRazlog: ${cancel_reason}\n\nKapetan Luka`
                        : "Poštovani,\n\nObavještavamo Vas da je stajalište otkazano.\n\nKapetan Luka",
                });
            }
            return body;
        } catch (err) { return rejectWithValue(err.response?.data?.data || { message: err.message }); }
    }
);

export const fetchCapacityCategoriesThunk = createAsyncThunk(
    "sailing/fetchCategories",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/booking/capacity_categories");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.categories || [];
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

const sailingSlice = createSlice({
    name: "sailing",
    initialState: {
        lines: [],
        sailings: [],
        categories: [],
        filter: {
            line_uuid: "",
            departure_date: new Date().toISOString().slice(0, 10),
        },
        selected: null, // { sailing, legs, bookings }
        error: null,
    },
    reducers: {
        setSailingFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.filter[path] = value;
        },
        clearSelected(state) { state.selected = null; },
        clearError(state) { state.error = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSailingLinesThunk.fulfilled, (s, a) => { s.lines = a.payload || []; })
            .addCase(fetchSailingsThunk.fulfilled, (s, a) => { s.sailings = a.payload || []; })
            .addCase(fetchSailingsThunk.rejected, (s, a) => { s.error = a.payload?.message || "Greška"; })
            .addCase(fetchSailingDetailsThunk.fulfilled, (s, a) => { s.selected = a.payload; })
            .addCase(fetchCapacityCategoriesThunk.fulfilled, (s, a) => { s.categories = a.payload || []; });
    },
});

export const { setSailingFilter, clearSelected, clearError } = sailingSlice.actions;
export const sailingSliceData = (state) => state.sailing;
export default sailingSlice.reducer;
