import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const prod = false;
const backendURL = prod ? "https://bookingtest.krilo.hr/app" : "http://localhost:5100";

const api = axios.create({ baseURL: backendURL, withCredentials: true });
const unwrapBff = (resp) => resp.data?.data?.data ?? resp.data?.data ?? resp.data;

export const fetchCapacityCategoriesThunk = createAsyncThunk(
    "booking/fetchCategories",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/booking/capacity_categories");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.categories || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchTicketTypeMappingsThunk = createAsyncThunk(
    "booking/fetchMappings",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/booking/ticket_type_mappings");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.mappings || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const saveTicketTypeMappingThunk = createAsyncThunk(
    "booking/saveMapping",
    async (payload, { dispatch, rejectWithValue }) => {
        try {
            await api.post("/portal/booking/ticket_type_mappings", payload);
            await dispatch(fetchTicketTypeMappingsThunk());
            return true;
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const saveCapacityCategoryThunk = createAsyncThunk(
    "booking/saveCategory",
    async (payload, { dispatch, rejectWithValue }) => {
        try {
            if (payload.uuid) {
                await api.patch("/portal/booking/capacity_categories", payload);
            } else {
                await api.post("/portal/booking/capacity_categories", payload);
            }
            await dispatch(fetchCapacityCategoriesThunk());
            return true;
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

const bookingSlice = createSlice({
    name: "booking",
    initialState: {
        categories: [],
        mappings: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchCapacityCategoriesThunk.fulfilled, (s, a) => { s.categories = a.payload || []; })
            .addCase(fetchTicketTypeMappingsThunk.fulfilled, (s, a) => { s.mappings = a.payload || []; });
    },
});

export const bookingSliceData = (state) => state.booking;
export default bookingSlice.reducer;
