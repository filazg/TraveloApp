import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const prod = true;
const backendURL = prod ? "https://bookingtest.krilo.hr/app" : "http://localhost:5100";

const api = axios.create({
    baseURL: backendURL,
    withCredentials: true,
});

// Portal → gateway → web_portal-service (BFF) → transactions-service / backoffice-service.
// BFF response shape: { status, data: { path1, path2, data: <actual payload> } }
const unwrapBff = (resp) => resp.data?.data?.data ?? resp.data?.data ?? resp.data;

export const fetchInvoicesThunk = createAsyncThunk(
    "finance/fetchInvoices",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/invoices", { params });
            const payload = unwrapBff(resp);
            return {
                invoices: payload?.invoices || [],
                total: payload?.total || 0,
            };
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchInvoiceDetailsThunk = createAsyncThunk(
    "finance/fetchInvoiceDetails",
    async (invoice_uuid, { rejectWithValue }) => {
        try {
            const resp = await api.get(`/portal/transactions/invoice/${invoice_uuid}`);
            return unwrapBff(resp);
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchBillingDevicesThunk = createAsyncThunk(
    "finance/fetchBillingDevices",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/backoffice/billing_devices");
            const payload = unwrapBff(resp);
            // BFF returns billing_devices as an array directly under `data.data`.
            return Array.isArray(payload) ? payload : payload?.billing_devices || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchPartnerInvoicesThunk = createAsyncThunk(
    "finance/fetchPartnerInvoices",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/partner_invoices", { params });
            const payload = unwrapBff(resp);
            return {
                invoices: payload?.invoices || [],
                total: payload?.total || 0,
            };
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchPartnerInvoiceDetailsThunk = createAsyncThunk(
    "finance/fetchPartnerInvoiceDetails",
    async (partner_invoice_uuid, { rejectWithValue }) => {
        try {
            const resp = await api.get(`/portal/transactions/partner_invoice/${partner_invoice_uuid}`);
            return unwrapBff(resp);
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchPartnersListThunk = createAsyncThunk(
    "finance/fetchPartnersList",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/backoffice/partners");
            const payload = unwrapBff(resp);
            const list = payload?.partners || (Array.isArray(payload) ? payload : []);
            return list.map((p) => ({ uuid: p.uuid, partner_name: p.partner_name, is_active: p.is_active }));
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchTicketsThunk = createAsyncThunk(
    "finance/fetchTickets",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/tickets_search", { params });
            const payload = unwrapBff(resp);
            return {
                tickets: payload?.tickets || [],
                total: payload?.total || 0,
            };
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchLinesThunk = createAsyncThunk(
    "finance/fetchLines",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/boat/lines");
            const payload = unwrapBff(resp);
            const list = payload?.lines || (Array.isArray(payload) ? payload : []);
            return list;
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchHarborsThunk = createAsyncThunk(
    "finance/fetchHarbors",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/boat/harbors");
            const payload = unwrapBff(resp);
            const list = payload?.harbors || (Array.isArray(payload) ? payload : []);
            return list;
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchBillingDevicesFullThunk = createAsyncThunk(
    "finance/fetchBillingDevicesFull",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/backoffice/billing_devices");
            const payload = unwrapBff(resp);
            const list = Array.isArray(payload) ? payload : payload?.billing_devices || [];
            return list;
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchBusinessPremisesListThunk = createAsyncThunk(
    "finance/fetchBusinessPremisesList",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/backoffice/business_premises");
            const payload = unwrapBff(resp);
            const list = Array.isArray(payload) ? payload : payload?.business_premises || [];
            return list;
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchManagementReportThunk = createAsyncThunk(
    "finance/fetchManagementReport",
    async (month, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/management_report", { params: { month, by: "travel" } });
            return unwrapBff(resp) || {};
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchPurchaseReportThunk = createAsyncThunk(
    "finance/fetchPurchaseReport",
    async (month, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/management_report", { params: { month, by: "purchase" } });
            return unwrapBff(resp) || {};
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchHarborTaxReportThunk = createAsyncThunk(
    "finance/fetchHarborTaxReport",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/harbor_tax_report", { params });
            return unwrapBff(resp) || {};
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchShiftsThunk = createAsyncThunk(
    "finance/fetchShifts",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/shifts", { params });
            const payload = unwrapBff(resp);
            return Array.isArray(payload?.shifts) ? payload.shifts : (Array.isArray(payload) ? payload : []);
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const cancelTicketsThunk = createAsyncThunk(
    "finance/cancelTickets",
    async (payload, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/transactions/cancel_tickets", payload);
            if (resp.data?.status && resp.data.status >= 400) {
                return rejectWithValue(resp.data?.data || { message: "cancel failed" });
            }
            return resp.data?.data || {};
        } catch (err) {
            return rejectWithValue(err.response?.data?.data || { message: err.message });
        }
    }
);

const financeSlice = createSlice({
    name: "finance",
    initialState: {
        invoices: [],
        total: 0,
        loading: false,
        error: null,
        billingDevices: [],
        invoiceDetails: null,
        invoiceDetailsLoading: false,
        partnerInvoices: [],
        partnerInvoicesLoading: false,
        partnerInvoicesError: null,
        partnerInvoiceDetails: null,
        partnerInvoiceDetailsLoading: false,
        partnersList: [],
        partnerInvoiceFilters: {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            partner_uuid: "",
        },
        tickets: [],
        ticketsLoading: false,
        ticketsError: null,
        linesList: [],
        harborsList: [],
        billingDevicesFull: [],
        businessPremisesList: [],
        cancelLoading: false,
        cancelError: null,
        cancelResult: null,
        harborTaxReport: null,
        harborTaxReportLoading: false,
        harborTaxReportError: null,
        harborTaxReportFilters: {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
        },
        shifts: [],
        shiftsLoading: false,
        shiftsError: null,
        shiftsFilters: {
            from: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
            to: new Date().toISOString().slice(0, 10),
            operater_username: "",
            billing_device_uuid: "",
            shift_open: "",
        },
        managementReport: null,
        managementReportLoading: false,
        managementReportError: null,
        managementReportMonth: new Date().toISOString().slice(0, 7),
        purchaseReport: null,
        purchaseReportLoading: false,
        purchaseReportError: null,
        purchaseReportMonth: new Date().toISOString().slice(0, 7),
        ticketsFilters: {
            date: new Date().toISOString().slice(0, 10),
            line_code: "",
            departure_harbor_id: "",
            arrival_harbor_id: "",
            status: "",
            ticket_code: "",
        },
        filters: {
            billing_device_uuid: "",
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            buyer_email: "",
            buyer_company_name: "",
            invoice_code: "",
            invoice_status: "",
        },
    },
    reducers: {
        setFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.filters[path] = value;
        },
        resetFilters(state) {
            state.filters = {
                billing_device_uuid: "",
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1,
                buyer_email: "",
                buyer_company_name: "",
                invoice_code: "",
                invoice_status: "",
            };
        },
        setPartnerInvoiceFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.partnerInvoiceFilters[path] = value;
        },
        setTicketsFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.ticketsFilters[path] = value;
        },
        setHarborTaxReportFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.harborTaxReportFilters[path] = value;
        },
        setManagementReportMonth(state, action) {
            state.managementReportMonth = action.payload;
        },
        setPurchaseReportMonth(state, action) {
            state.purchaseReportMonth = action.payload;
        },
        setShiftsFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.shiftsFilters[path] = value;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchInvoicesThunk.pending, (s) => {
                s.loading = true;
                s.error = null;
            })
            .addCase(fetchInvoicesThunk.fulfilled, (s, a) => {
                s.loading = false;
                s.invoices = a.payload.invoices || [];
                s.total = a.payload.total || 0;
            })
            .addCase(fetchInvoicesThunk.rejected, (s, a) => {
                s.loading = false;
                s.error = a.payload?.message || "Greška pri dohvatu računa";
            })
            .addCase(fetchBillingDevicesThunk.fulfilled, (s, a) => {
                s.billingDevices = a.payload || [];
            })
            .addCase(fetchInvoiceDetailsThunk.pending, (s) => {
                s.invoiceDetailsLoading = true;
                s.invoiceDetails = null;
            })
            .addCase(fetchInvoiceDetailsThunk.fulfilled, (s, a) => {
                s.invoiceDetailsLoading = false;
                s.invoiceDetails = a.payload || null;
            })
            .addCase(fetchInvoiceDetailsThunk.rejected, (s) => {
                s.invoiceDetailsLoading = false;
            })
            .addCase(fetchPartnerInvoicesThunk.pending, (s) => {
                s.partnerInvoicesLoading = true;
                s.partnerInvoicesError = null;
            })
            .addCase(fetchPartnerInvoicesThunk.fulfilled, (s, a) => {
                s.partnerInvoicesLoading = false;
                s.partnerInvoices = a.payload.invoices || [];
            })
            .addCase(fetchPartnerInvoicesThunk.rejected, (s, a) => {
                s.partnerInvoicesLoading = false;
                s.partnerInvoicesError = a.payload?.message || "Greška pri dohvatu partner računa";
            })
            .addCase(fetchPartnerInvoiceDetailsThunk.pending, (s) => {
                s.partnerInvoiceDetailsLoading = true;
                s.partnerInvoiceDetails = null;
            })
            .addCase(fetchPartnerInvoiceDetailsThunk.fulfilled, (s, a) => {
                s.partnerInvoiceDetailsLoading = false;
                s.partnerInvoiceDetails = a.payload || null;
            })
            .addCase(fetchPartnerInvoiceDetailsThunk.rejected, (s) => {
                s.partnerInvoiceDetailsLoading = false;
            })
            .addCase(fetchPartnersListThunk.fulfilled, (s, a) => {
                s.partnersList = a.payload || [];
            })
            .addCase(fetchTicketsThunk.pending, (s) => {
                s.ticketsLoading = true;
                s.ticketsError = null;
            })
            .addCase(fetchTicketsThunk.fulfilled, (s, a) => {
                s.ticketsLoading = false;
                s.tickets = a.payload.tickets || [];
            })
            .addCase(fetchTicketsThunk.rejected, (s, a) => {
                s.ticketsLoading = false;
                s.ticketsError = a.payload?.message || "Greška pri dohvatu karata";
            })
            .addCase(fetchLinesThunk.fulfilled, (s, a) => {
                s.linesList = a.payload || [];
            })
            .addCase(fetchHarborsThunk.fulfilled, (s, a) => {
                s.harborsList = a.payload || [];
            })
            .addCase(fetchBillingDevicesFullThunk.fulfilled, (s, a) => {
                s.billingDevicesFull = a.payload || [];
            })
            .addCase(fetchBusinessPremisesListThunk.fulfilled, (s, a) => {
                s.businessPremisesList = a.payload || [];
            })
            .addCase(cancelTicketsThunk.pending, (s) => {
                s.cancelLoading = true;
                s.cancelError = null;
                s.cancelResult = null;
            })
            .addCase(cancelTicketsThunk.fulfilled, (s, a) => {
                s.cancelLoading = false;
                s.cancelResult = a.payload || {};
            })
            .addCase(cancelTicketsThunk.rejected, (s, a) => {
                s.cancelLoading = false;
                s.cancelError = a.payload?.message || "Storno nije uspio";
            })
            .addCase(fetchManagementReportThunk.pending, (s) => {
                s.managementReportLoading = true;
                s.managementReportError = null;
            })
            .addCase(fetchManagementReportThunk.fulfilled, (s, a) => {
                s.managementReportLoading = false;
                s.managementReport = a.payload || null;
            })
            .addCase(fetchManagementReportThunk.rejected, (s, a) => {
                s.managementReportLoading = false;
                s.managementReportError = a.payload?.message || "Greška pri dohvatu izvještaja";
            })
            .addCase(fetchPurchaseReportThunk.pending, (s) => {
                s.purchaseReportLoading = true;
                s.purchaseReportError = null;
            })
            .addCase(fetchPurchaseReportThunk.fulfilled, (s, a) => {
                s.purchaseReportLoading = false;
                s.purchaseReport = a.payload || null;
            })
            .addCase(fetchPurchaseReportThunk.rejected, (s, a) => {
                s.purchaseReportLoading = false;
                s.purchaseReportError = a.payload?.message || "Greška pri dohvatu izvještaja";
            })
            .addCase(fetchHarborTaxReportThunk.pending, (s) => {
                s.harborTaxReportLoading = true;
                s.harborTaxReportError = null;
            })
            .addCase(fetchHarborTaxReportThunk.fulfilled, (s, a) => {
                s.harborTaxReportLoading = false;
                s.harborTaxReport = a.payload || null;
            })
            .addCase(fetchHarborTaxReportThunk.rejected, (s, a) => {
                s.harborTaxReportLoading = false;
                s.harborTaxReportError = a.payload?.message || "Greška pri dohvatu izvještaja";
            })
            .addCase(fetchShiftsThunk.pending, (s) => {
                s.shiftsLoading = true;
                s.shiftsError = null;
            })
            .addCase(fetchShiftsThunk.fulfilled, (s, a) => {
                s.shiftsLoading = false;
                s.shifts = a.payload || [];
            })
            .addCase(fetchShiftsThunk.rejected, (s, a) => {
                s.shiftsLoading = false;
                s.shiftsError = a.payload?.message || "Greška pri dohvatu smjena";
            });
    },
});

export const financeSliceData = (state) => state.finance;
export const { setFilter, resetFilters, setPartnerInvoiceFilter, setTicketsFilter, setHarborTaxReportFilter, setManagementReportMonth, setPurchaseReportMonth, setShiftsFilter } = financeSlice.actions;
export const invoicePdfUrl = (invoice_uuid) => `${backendURL}/portal/transactions/invoice_pdf/${invoice_uuid}`;

// Download the invoice PDF forcing it to save (not open in a tab). Fetches as
// blob via the authenticated axios instance, creates a client-side object URL
// and triggers a download — bypasses cross-origin `<a download>` quirks.
export const downloadInvoicePdf = async (invoice_uuid, filename) => {
    const resp = await api.get(`/portal/transactions/invoice_pdf/${invoice_uuid}`, {
        responseType: "blob",
    });
    const blob = new Blob([resp.data], { type: "application/pdf" });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename || `invoice-${invoice_uuid.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
};

export default financeSlice.reducer;
