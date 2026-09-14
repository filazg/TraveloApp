import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { resolveBackendUrl } from "../../helpers/backendUrl";

// Provjera stanja gleda iste polaske kao kapetanski modul, samo drugim očima:
// ondje se vodi jedna plovidba, ovdje se traži gdje ima mjesta. Zato koristi
// isti poziv (`/portal/sailing/sailings` s rezervacijama) i nema svoj backend —
// jedan izvor podataka znači i jedno mjesto na kojem brojka može biti kriva.
const backendURL = resolveBackendUrl("/app");
const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrapBff = (resp) => resp.data?.data?.data ?? resp.data?.data ?? resp.data;

export const fetchLinesThunk = createAsyncThunk(
    "stanje/fetchLines",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/boat/lines");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.lines || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchStanjeThunk = createAsyncThunk(
    "stanje/fetchStanje",
    async ({ departure_date, line_uuid }, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/sailing/sailings", {
                // Bez `include=bookings` vratili bi se samo polasci, bez ijedne
                // brojke o zauzetosti — a to je jedino zbog čega ovaj zaslon postoji.
                params: { departure_date, line_uuid: line_uuid || undefined, include: "bookings" },
            });
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.sailings || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

const stanjeSlice = createSlice({
    name: "stanje",
    initialState: {
        lines: [],
        sailings: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (s) => { s.error = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchLinesThunk.fulfilled, (s, a) => { s.lines = a.payload || []; })
            .addCase(fetchStanjeThunk.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchStanjeThunk.fulfilled, (s, a) => {
                s.loading = false;
                s.sailings = a.payload || [];
            })
            .addCase(fetchStanjeThunk.rejected, (s, a) => {
                s.loading = false;
                s.error = a.payload?.message || "Dohvat stanja nije uspio.";
            });
    },
});

export const { clearError } = stanjeSlice.actions;
export const stanjeSliceData = (state) => state.stanje;
export default stanjeSlice.reducer;
