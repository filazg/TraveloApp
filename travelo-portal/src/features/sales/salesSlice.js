import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { resolveBackendUrl } from "../../helpers/backendUrl"

const backendURL = resolveBackendUrl('/app')

const api = axios.create({ baseURL: backendURL, withCredentials: true });

const unwrapBff = (resp) => resp.data?.data?.data ?? resp.data?.data ?? resp.data;

export const fetchPosLinesThunk = createAsyncThunk("sales/fetchLines", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/boat/lines");
        const payload = unwrapBff(resp);
        return Array.isArray(payload) ? payload : payload?.lines || [];
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchPosHarborsThunk = createAsyncThunk("sales/fetchHarbors", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/boat/harbors");
        const payload = unwrapBff(resp);
        return Array.isArray(payload) ? payload : payload?.harbors || [];
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchPosRoutesThunk = createAsyncThunk("sales/fetchRoutes", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/sales/routes");
        const payload = unwrapBff(resp);
        return Array.isArray(payload) ? payload : [];
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchPosPricesThunk = createAsyncThunk("sales/fetchPrices", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/sales/prices");
        const payload = unwrapBff(resp);
        return Array.isArray(payload) ? payload : [];
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchPosBillingDevicesThunk = createAsyncThunk("sales/fetchBillingDevices", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/backoffice/billing_devices");
        const payload = unwrapBff(resp);
        return Array.isArray(payload) ? payload : payload?.billing_devices || [];
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchPosVoyageBookingsThunk = createAsyncThunk(
    "sales/fetchVoyageBookings",
    async (departure_uuid, { rejectWithValue }) => {
        try {
            if (!departure_uuid) return { departure_uuid: null, bookings: [] };
            const resp = await api.get("/portal/booking/bookings", { params: { departure_uuid } });
            const payload = unwrapBff(resp);
            const list = Array.isArray(payload) ? payload : payload?.bookings || [];
            return { departure_uuid, bookings: list };
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

export const fetchMySalesThunk = createAsyncThunk(
    "sales/fetchMySales",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/invoices", { params });
            const payload = unwrapBff(resp);
            return {
                invoices: payload?.invoices || [],
                total: payload?.total || 0,
            };
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

export const fetchPosTicketTypeMappingsThunk = createAsyncThunk(
    "sales/fetchTtMappings",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/booking/ticket_type_mappings");
            const payload = unwrapBff(resp);
            return Array.isArray(payload) ? payload : payload?.mappings || [];
        } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
    }
);

export const fetchPosBusinessPremisesThunk = createAsyncThunk("sales/fetchBusinessPremises", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/backoffice/business_premises");
        const payload = unwrapBff(resp);
        return Array.isArray(payload) ? payload : payload?.business_premises || [];
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchPosCountriesThunk = createAsyncThunk("sales/fetchCountries", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/backoffice/countries", { params: { only_active: "true" } });
        const payload = unwrapBff(resp);
        const list = Array.isArray(payload) ? payload : payload?.countries || [];
        return list.filter((c) => c.is_active !== false);
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchAddressbookThunk = createAsyncThunk("sales/fetchAddressbook", async (_, { rejectWithValue }) => {
    try {
        const resp = await api.get("/portal/backoffice/addressbook");
        const payload = unwrapBff(resp);
        const list = Array.isArray(payload) ? payload : payload?.addressbook || [];
        return list.filter((e) => e.buyer_is_active !== false);
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const fetchInitialPosDataThunk = createAsyncThunk(
    "sales/fetchInitial",
    async (_, { dispatch }) => {
        await Promise.all([
            dispatch(fetchPosLinesThunk()),
            dispatch(fetchPosHarborsThunk()),
            dispatch(fetchPosRoutesThunk()),
            dispatch(fetchPosPricesThunk()),
            dispatch(fetchPosBillingDevicesThunk()),
            dispatch(fetchPosBusinessPremisesThunk()),
            dispatch(fetchAddressbookThunk()),
            dispatch(fetchPosCountriesThunk()),
            dispatch(fetchPosTicketTypeMappingsThunk()),
        ]);
        return true;
    }
);

export const saveAddressbookEntryThunk = createAsyncThunk("sales/saveAddressbookEntry", async (buyer, { rejectWithValue, dispatch }) => {
    try {
        const payload = {
            buyer_name: buyer.buyer_name || null,
            buyer_company_name: buyer.buyer_company_name || null,
            buyer_legal_id: buyer.buyer_oib || null,
            buyer_vat_id: buyer.buyer_oib || null,
            buyer_address: buyer.buyer_address || null,
            buyer_town: buyer.buyer_town || null,
            buyer_postal_code: buyer.buyer_postal_code || null,
            buyer_country: buyer.buyer_country || null,
            buyer_email: buyer.buyer_email || null,
            f2_required: !!buyer.f2_required,
        };
        await api.post("/portal/backoffice/addressbook", payload);
        await dispatch(fetchAddressbookThunk());
        return true;
    } catch (err) { return rejectWithValue(err.response?.data || { message: err.message }); }
});

export const emailInvoiceTicketsThunk = createAsyncThunk(
    "sales/emailInvoiceTickets",
    async (payload, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/transactions/email_invoice_tickets", payload);
            const body = resp.data || {};
            const data = body.data ?? body;
            if (body.status && body.status >= 400) {
                return rejectWithValue({ message: data?.message || `HTTP ${body.status}` });
            }
            return data;
        } catch (err) {
            console.log("emailInvoiceTicketsThunk error:", err?.response?.status, err?.response?.data, err?.message);
            const resp = err.response?.data;
            let msg = err.message;
            if (resp && typeof resp === "object") {
                msg = resp.data?.message || resp.message || msg;
            } else if (typeof resp === "string") {
                // Strip HTML if backend responded with an error page (e.g. 404).
                msg = resp.replace(/<[^>]+>/g, "").trim().slice(0, 200) || msg;
            }
            return rejectWithValue({ message: msg });
        }
    }
);

export const finalizePosSaleThunk = createAsyncThunk("sales/finalize", async (payload, { rejectWithValue }) => {
    try {
        const resp = await api.post("/portal/transactions/finalize_terminal_sale", payload);
        const body = resp.data?.data ?? resp.data ?? {};
        if (resp.data?.message && !body.invoice_uuid) {
            return rejectWithValue({ message: resp.data.message });
        }
        return body;
    } catch (err) {
        const e = err.response?.data;
        return rejectWithValue(e?.data || e || { message: err.message });
    }
});

const initialBuyer = {
    buyer_name: "",
    buyer_company_name: "",
    buyer_oib: "",
    buyer_address: "",
    buyer_postal_code: "",
    buyer_town: "",
    buyer_country: "",
    buyer_email: "",
    buyer_tel: "",
    f2_required: false,
};

const salesSlice = createSlice({
    name: "sales",
    initialState: {
        lines: [],
        harbors: [],
        routes: [],
        prices: [],
        billingDevices: [],
        businessPremises: [],
        addressbook: [],
        countries: [],
        voyageBookings: [],
        voyageBookingsFor: null,
        ticketTypeMappings: [],
        mySales: [],
        filters: {
            line_code: "",
            travel_date: new Date().toISOString().slice(0, 10),
            departure_harbor_id: "",
            departure: null,
        },
        cart: [],
        selectedTerminal: "",
        selectedPaymentMethod: "",
        buyer: { ...initialBuyer },
        finalizing: false,
        lastInvoice: null,
        error: null,
    },
    reducers: {
        setFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.filters[path] = value;
        },
        resetDepartureChain(state) {
            state.filters.departure = null;
            state.filters.departure_harbor_id = "";
        },
        setDeparture(state, action) {
            state.filters.departure = action.payload;
        },
        addCartItem(state, action) {
            state.cart.push(action.payload);
        },
        removeCartItem(state, action) {
            state.cart = state.cart.filter((_, i) => i !== action.payload);
        },
        clearCart(state) { state.cart = []; },
        setTerminal(state, action) {
            state.selectedTerminal = action.payload;
            state.selectedPaymentMethod = "";
        },
        setPaymentMethod(state, action) { state.selectedPaymentMethod = action.payload; },
        setBuyerField(state, action) {
            const { field, value } = action.payload || {};
            if (field) state.buyer[field] = value;
        },
        setBuyer(state, action) {
            state.buyer = { ...initialBuyer, ...(action.payload || {}) };
        },
        clearBuyer(state) { state.buyer = { ...initialBuyer }; },
        clearLastInvoice(state) { state.lastInvoice = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPosLinesThunk.fulfilled, (s, a) => { s.lines = a.payload || []; })
            .addCase(fetchPosHarborsThunk.fulfilled, (s, a) => { s.harbors = a.payload || []; })
            .addCase(fetchPosRoutesThunk.fulfilled, (s, a) => { s.routes = a.payload || []; })
            .addCase(fetchPosPricesThunk.fulfilled, (s, a) => { s.prices = a.payload || []; })
            .addCase(fetchPosBillingDevicesThunk.fulfilled, (s, a) => { s.billingDevices = a.payload || []; })
            .addCase(fetchPosBusinessPremisesThunk.fulfilled, (s, a) => { s.businessPremises = a.payload || []; })
            .addCase(fetchPosVoyageBookingsThunk.fulfilled, (s, a) => {
                s.voyageBookings = a.payload?.bookings || [];
                s.voyageBookingsFor = a.payload?.departure_uuid || null;
            })
            .addCase(fetchPosTicketTypeMappingsThunk.fulfilled, (s, a) => { s.ticketTypeMappings = a.payload || []; })
            .addCase(fetchMySalesThunk.fulfilled, (s, a) => {
                s.mySales = a.payload?.invoices || [];
            })
            .addCase(fetchAddressbookThunk.fulfilled, (s, a) => { s.addressbook = a.payload || []; })
            .addCase(fetchPosCountriesThunk.fulfilled, (s, a) => { s.countries = a.payload || []; })
            .addCase(finalizePosSaleThunk.pending, (s) => { s.finalizing = true; s.error = null; })
            .addCase(finalizePosSaleThunk.fulfilled, (s, a) => {
                s.finalizing = false;
                s.lastInvoice = a.payload;
                s.cart = [];
                s.buyer = { ...initialBuyer };
            })
            .addCase(finalizePosSaleThunk.rejected, (s, a) => {
                s.finalizing = false;
                s.error = a.payload?.message || "Izdavanje nije uspjelo";
            });
    },
});

export const {
    setFilter, resetDepartureChain, setDeparture,
    addCartItem, removeCartItem, clearCart,
    setTerminal, setPaymentMethod,
    setBuyerField, setBuyer, clearBuyer, clearLastInvoice,
} = salesSlice.actions;

export const salesSliceData = (state) => state.sales;
export const invoicePdfUrl = (uuid) => `${backendURL}/portal/transactions/invoice_pdf/${uuid}`;
export const ticketsPdfUrl = (orderUuid) => `${backendURL}/portal/transactions/tickets_pdf/${orderUuid}`;
export default salesSlice.reducer;
