import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { resolveBackendUrl } from "../../helpers/backendUrl"

const backendURL = resolveBackendUrl('/app')

const api = axios.create({
    baseURL: backendURL,
    withCredentials: true,
});

// Portal → gateway → web_portal-service (BFF) → transactions-service / backoffice-service.
// BFF response shape: { status, data: { path1, path2, data: <actual payload> } }
const unwrapBff = (resp) => resp.data?.data?.data ?? resp.data?.data ?? resp.data;

// POST odgovori: gateway skida jednu razinu omota (`res.json(response.data.data)`),
// pa je `resp.data` već sam sadržaj. Kad se ide izravno na BFF, ostaje još
// jedna razina. Toleriraju se oba oblika — inače se dobije prazan objekt i
// prozor rezultata ostane bez broja računa i bez `invoice_uuid`.
const unwrapPost = (resp) => resp?.data?.data ?? resp?.data ?? {};
const unwrapPostError = (err) => err.response?.data?.data ?? err.response?.data ?? null;

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

// Obračun provizije partnerima koji prodaju u naše ime. Nije popis dokumenata
// nego izračun za razdoblje — poslužitelj svaki put zbroji prodaju s partnerskih
// prodajnih mjesta, pa se ništa ne pamti ni ne zastarijeva.
export const fetchPartnerCommissionThunk = createAsyncThunk(
    "finance/fetchPartnerCommission",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/partner_commission", { params });
            const payload = unwrapBff(resp);
            return {
                partners: payload?.partners || [],
                totals: payload?.totals || { tickets: 0, gross: 0, base: 0, commission: 0 },
                from: payload?.from || params.from || "",
                to: payload?.to || params.to || "",
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
            // Uz naziv se zadržavaju i podaci koje traži izvještaj o otkazanim
            // kartama: OIB i kontakt idu u zaglavlje, provizija u obračun onoga
            // što se partneru skida sa zbirnog računa.
            return list.map((p) => ({
                uuid: p.uuid,
                partner_name: p.partner_name,
                partner_acr: p.partner_acr,
                partner_legal_id: p.partner_legal_id,
                partner_email: p.partner_email,
                partner_contact_person: p.partner_contact_person,
                commission_pct: p.commission_pct,
                is_active: p.is_active,
            }));
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

export const fetchPaymentMethodsListThunk = createAsyncThunk(
    "finance/fetchPaymentMethodsList",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/backoffice/payment_methods");
            const payload = unwrapBff(resp);
            // Šifarnik nosi `card_provider`, kojeg sredstvo na naplatnom uređaju
            // nema — a po njemu se zna u čiji nalog ide povrat na karticu.
            return Array.isArray(payload) ? payload : payload?.payment_methods || [];
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

export const fetchDailyRealizationThunk = createAsyncThunk(
    "finance/fetchDailyRealization",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/daily_realization", { params });
            return unwrapBff(resp) || {};
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const sendDailyRealizationToErpThunk = createAsyncThunk(
    "finance/sendDailyRealizationToErp",
    async (payload, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/transactions/daily_realization/send_to_erp", payload);
            return { date: payload?.date, response: resp.data || {} };
        } catch (err) {
            return rejectWithValue({ date: payload?.date, error: err.response?.data || { message: err.message } });
        }
    }
);

export const fetchDailyRealizationDemoThunk = createAsyncThunk(
    "finance/fetchDailyRealizationDemo",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/daily_realization_demo", { params });
            return unwrapBff(resp) || {};
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const sendDailyRealizationDemoToErpThunk = createAsyncThunk(
    "finance/sendDailyRealizationDemoToErp",
    async (payload, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/transactions/daily_realization_demo/send_to_erp", payload);
            return { date: payload?.date, response: resp.data || {} };
        } catch (err) {
            return rejectWithValue({ date: payload?.date, error: err.response?.data || { message: err.message } });
        }
    }
);

export const cancelTicketsThunk = createAsyncThunk(
    "finance/cancelTickets",
    async (payload, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/transactions/cancel_tickets", payload);
            if (resp.data?.status && resp.data.status >= 400) {
                return rejectWithValue(unwrapPost(resp) || { message: "cancel failed" });
            }
            return unwrapPost(resp);
        } catch (err) {
            const podaci = unwrapPostError(err);
            return rejectWithValue({ message: podaci?.message || err.message });
        }
    }
);

// Sifarnik postotaka priznavanja (Puni povrat, Promjena karte, Otkaz manje
// od 24h). Isti se popis koristi i za storno i za promjenu karte.
export const fetchStornoPercentagesThunk = createAsyncThunk(
    "finance/fetchStornoPercentages",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/backoffice/storno_percentages");
            const p = unwrapBff(resp);
            return Array.isArray(p) ? p : (p?.storno_percentages || []);
        } catch (err) { return rejectWithValue({ message: err.message }); }
    }
);

// Polasci i cjenik — trebaju za odabir novog polaska pri promjeni karte.
export const fetchSalesRoutesThunk = createAsyncThunk(
    "finance/fetchSalesRoutes",
    async (_, { rejectWithValue }) => {
        try {
            // Isti rez kao u POS prodaji: samo stupci koji se koriste i bez
            // prošlih polazaka. Vozni red je nekoliko tisuća redaka, a pregled
            // karata i promjena polaska od njega trebaju samo linije, vremena i
            // luke — bez toga se pri svakom ulasku vukla puna tablica.
            const od = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
            const resp = await api.get("/portal/sales/routes", { params: { from_date: od, fields: "pos" } });
            const p = unwrapBff(resp);
            return Array.isArray(p) ? p : (p?.routes || []);
        } catch (err) { return rejectWithValue({ message: err.message }); }
    }
);

export const fetchSalesPricesThunk = createAsyncThunk(
    "finance/fetchSalesPrices",
    async (_, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/sales/prices");
            const p = unwrapBff(resp);
            return Array.isArray(p) ? p : (p?.prices || []);
        } catch (err) { return rejectWithValue({ message: err.message }); }
    }
);

// Promjena karte ide u dva koraka: prvo se izda racun razlike uobicajenim
// putem prodaje (blagajne su autoritet za numeraciju), pa se tek onda stara
// karta zatvori i veze na novu. Zato drugi poziv smije biti ponovljen.
export const transferTicketsThunk = createAsyncThunk(
    "finance/transferTickets",
    async (payload, { rejectWithValue }) => {
        try {
            const prodaja = await api.post("/portal/transactions/finalize_terminal_sale", payload.sale);
            const prodajaData = unwrapPost(prodaja);
            if (prodaja.data?.status && prodaja.data.status >= 400) {
                return rejectWithValue(prodajaData || { message: "racun razlike nije izdan" });
            }
            const noveKarte = prodajaData.tickets || [];
            if (noveKarte.length !== payload.source_ticket_uuids.length) {
                return rejectWithValue({
                    message: `racun je izdan, ali je vraceno ${noveKarte.length} novih karata za ${payload.source_ticket_uuids.length} starih`,
                    invoice: prodajaData,
                });
            }
            const pairs = payload.source_ticket_uuids.map((from, i) => ({
                from_ticket_uuid: from,
                to_ticket_uuid: noveKarte[i].ticket_uuid,
            }));
            const veza = await api.post("/portal/transactions/transfer_tickets", {
                pairs,
                percentage: payload.percentage,
                invoice_uuid: prodajaData.invoice_uuid,
            });
            if (veza.data?.status && veza.data.status >= 400) {
                return rejectWithValue({
                    message: (unwrapPost(veza)?.message || "stara karta nije zatvorena") + " — racun razlike JE izdan",
                    invoice: prodajaData,
                });
            }
            return { invoice: prodajaData, transfer: unwrapPost(veza) };
        } catch (err) {
            const podaci = unwrapPostError(err);
            return rejectWithValue({ message: podaci?.message || err.message, invoice: podaci?.invoice });
        }
    }
);
// Slanje racuna i karata putniku — isti endpoint kojim salje POS prodaja.
export const emailInvoiceTicketsThunk = createAsyncThunk(
    "finance/emailInvoiceTickets",
    async (payload, { rejectWithValue }) => {
        try {
            const resp = await api.post("/portal/transactions/email_invoice_tickets", payload);
            const body = resp.data || {};
            const data = body.data ?? body;
            if (body.status && body.status >= 400) {
                return rejectWithValue({ message: data?.message || ("HTTP " + body.status) });
            }
            return data;
        } catch (err) {
            const r = err.response?.data;
            let msg = err.message;
            if (r && typeof r === "object") msg = r.data?.message || r.message || msg;
            else if (typeof r === "string") msg = r.replace(/<[^>]+>/g, "").trim().slice(0, 200) || msg;
            return rejectWithValue({ message: msg });
        }
    }
);
// ——— Platni nalozi ——————————————————————————————————————————————————————
// Nalog je zbirka povrata kupcu, grupirana po tome kome se predaje: banci
// (SEPA) ili kartičarskoj kući (MONRI, OTP_POS, SEVENPAY). Stavke u nalog
// ulaze kroz storno karata.

export const fetchPaymentOrdersThunk = createAsyncThunk(
    "finance/fetchPaymentOrders",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/payment_orders", { params });
            const payload = unwrapBff(resp);
            return payload?.orders || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

export const fetchPaymentOrderDetailsThunk = createAsyncThunk(
    "finance/fetchPaymentOrderDetails",
    async (payment_order_uuid, { rejectWithValue }) => {
        try {
            const resp = await api.get(`/portal/transactions/payment_order/${payment_order_uuid}`);
            const payload = unwrapBff(resp);
            return { order: payload?.order || null, items: payload?.items || [] };
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

// POST rukovatelji BFF-a vraćaju tijelo transactions-servisa doslovno, pa je
// korisni sadržaj na `resp.data.data` — i poruka o grešci dolazi ista.
const nalogPost = async (putanja, payload, rejectWithValue) => {
    try {
        const resp = await api.post(putanja, payload);
        if (resp.data?.status && resp.data.status >= 400) {
            return rejectWithValue(unwrapPost(resp) || { message: "platni nalog nije spremljen" });
        }
        return unwrapPost(resp);
    } catch (err) {
        const podaci = unwrapPostError(err);
        return rejectWithValue({ message: podaci?.message || err.message });
    }
};

export const createPaymentOrderThunk = createAsyncThunk(
    "finance/createPaymentOrder",
    (payload, { rejectWithValue }) => nalogPost("/portal/transactions/payment_orders", payload, rejectWithValue)
);

export const setPaymentOrderStatusThunk = createAsyncThunk(
    "finance/setPaymentOrderStatus",
    (payload, { rejectWithValue }) => nalogPost("/portal/transactions/payment_order_status", payload, rejectWithValue)
);

export const addPaymentOrderItemThunk = createAsyncThunk(
    "finance/addPaymentOrderItem",
    (payload, { rejectWithValue }) => nalogPost("/portal/transactions/payment_order_items", payload, rejectWithValue)
);

export const deletePaymentOrderItemThunk = createAsyncThunk(
    "finance/deletePaymentOrderItem",
    (payload, { rejectWithValue }) => nalogPost("/portal/transactions/payment_order_item_delete", payload, rejectWithValue)
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
        partnerCommission: { partners: [], totals: { tickets: 0, gross: 0, base: 0, commission: 0 }, from: "", to: "" },
        // Otvoreno razdoblje se drži odvojeno od obračunskog: to su dva različita
        // podatka o istom partneru i ne smiju se pregaziti jedan drugim.
        partnerCommissionOpen: { partners: [], totals: { tickets: 0, gross: 0, base: 0, commission: 0 }, from: "", to: "" },
        partnerCommissionLoading: false,
        partnerCommissionError: null,
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
        paymentMethodsList: [],
        stornoPercentages: [],
        salesRoutes: [],
        salesPrices: [],
        transferLoading: false,
        transferError: null,
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
        paymentOrders: [],
        paymentOrdersLoading: false,
        paymentOrdersError: null,
        paymentOrderDetails: { order: null, items: [] },
        paymentOrderDetailsLoading: false,
        nalogSaving: false,
        nalogError: null,
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
        dailyRealization: null,
        dailyRealizationLoading: false,
        dailyRealizationError: null,
        dailyRealizationFilters: (() => {
            const now = new Date();
            const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            return {
                from: first.toISOString().slice(0, 10),
                to: now.toISOString().slice(0, 10),
            };
        })(),
        dailyRealizationSendByDay: {}, // { [date]: { loading, result, error } }
        dailyRealizationDemo: null,
        dailyRealizationDemoLoading: false,
        dailyRealizationDemoError: null,
        dailyRealizationDemoFilters: {
            from: "2026-05-01",
            to: "2026-05-05",
        },
        dailyRealizationDemoSendByDay: {},
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
            // Kanal, uređaj i sredstvo plaćanja čitaju se s računa karte;
            // polazak se traži po svim rutama tog putovanja.
            departure_key: "",
            channel: "",
            billing_device_uuid: "",
            payment_method_uuid: "",
            partner_uuid: "",
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
        setDailyRealizationFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.dailyRealizationFilters[path] = value;
        },
        clearDailyRealizationSendResult(state, action) {
            const date = action.payload;
            if (date) {
                delete state.dailyRealizationSendByDay[date];
            } else {
                state.dailyRealizationSendByDay = {};
            }
        },
        setDailyRealizationDemoFilter(state, action) {
            const { path, value } = action.payload || {};
            if (path) state.dailyRealizationDemoFilters[path] = value;
        },
        clearDailyRealizationDemoSendResult(state, action) {
            const date = action.payload;
            if (date) delete state.dailyRealizationDemoSendByDay[date];
            else state.dailyRealizationDemoSendByDay = {};
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
            .addCase(fetchPartnerCommissionThunk.pending, (s) => {
                s.partnerCommissionLoading = true;
                s.partnerCommissionError = null;
            })
            .addCase(fetchPartnerCommissionThunk.fulfilled, (s, a) => {
                s.partnerCommissionLoading = false;
                if (a.meta?.arg?.period === "current") s.partnerCommissionOpen = a.payload;
                else s.partnerCommission = a.payload;
            })
            .addCase(fetchPartnerCommissionThunk.rejected, (s, a) => {
                s.partnerCommissionLoading = false;
                s.partnerCommissionError = a.payload?.message || "Greška pri dohvatu obračuna provizije";
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
            .addCase(fetchStornoPercentagesThunk.fulfilled, (s, a) => { s.stornoPercentages = a.payload || []; })
            .addCase(fetchPaymentMethodsListThunk.fulfilled, (s, a) => { s.paymentMethodsList = a.payload || []; })
            .addCase(fetchSalesRoutesThunk.fulfilled, (s, a) => { s.salesRoutes = a.payload || []; })
            .addCase(fetchSalesPricesThunk.fulfilled, (s, a) => { s.salesPrices = a.payload || []; })
            .addCase(transferTicketsThunk.pending, (s) => { s.transferLoading = true; s.transferError = null; })
            .addCase(transferTicketsThunk.fulfilled, (s) => { s.transferLoading = false; })
            .addCase(transferTicketsThunk.rejected, (s, a) => { s.transferLoading = false; s.transferError = a.payload?.message || "Promjena nije uspjela"; })
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
            .addCase(fetchPaymentOrdersThunk.pending, (s) => {
                s.paymentOrdersLoading = true;
                s.paymentOrdersError = null;
            })
            .addCase(fetchPaymentOrdersThunk.fulfilled, (s, a) => {
                s.paymentOrdersLoading = false;
                s.paymentOrders = a.payload || [];
            })
            .addCase(fetchPaymentOrdersThunk.rejected, (s, a) => {
                s.paymentOrdersLoading = false;
                s.paymentOrdersError = a.payload?.message || "Dohvat platnih naloga nije uspio";
            })
            .addCase(fetchPaymentOrderDetailsThunk.pending, (s) => {
                s.paymentOrderDetailsLoading = true;
            })
            .addCase(fetchPaymentOrderDetailsThunk.fulfilled, (s, a) => {
                s.paymentOrderDetailsLoading = false;
                s.paymentOrderDetails = a.payload || { order: null, items: [] };
            })
            .addCase(fetchPaymentOrderDetailsThunk.rejected, (s) => {
                s.paymentOrderDetailsLoading = false;
                s.paymentOrderDetails = { order: null, items: [] };
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
            })
            .addCase(fetchDailyRealizationThunk.pending, (s) => {
                s.dailyRealizationLoading = true;
                s.dailyRealizationError = null;
            })
            .addCase(fetchDailyRealizationThunk.fulfilled, (s, a) => {
                s.dailyRealizationLoading = false;
                s.dailyRealization = a.payload || null;
            })
            .addCase(fetchDailyRealizationThunk.rejected, (s, a) => {
                s.dailyRealizationLoading = false;
                s.dailyRealizationError = a.payload?.message || "Greška pri dohvatu izvještaja";
            })
            .addCase(sendDailyRealizationToErpThunk.pending, (s, a) => {
                const date = a.meta?.arg?.date;
                if (!date) return;
                s.dailyRealizationSendByDay[date] = { loading: true, result: null, error: null };
            })
            .addCase(sendDailyRealizationToErpThunk.fulfilled, (s, a) => {
                const date = a.payload?.date;
                if (!date) return;
                s.dailyRealizationSendByDay[date] = {
                    loading: false,
                    result: a.payload?.response || {},
                    error: null,
                };
            })
            .addCase(sendDailyRealizationToErpThunk.rejected, (s, a) => {
                const date = a.payload?.date || a.meta?.arg?.date;
                if (!date) return;
                s.dailyRealizationSendByDay[date] = {
                    loading: false,
                    result: null,
                    error: a.payload?.error?.message || a.error?.message || "Slanje u ERP nije uspjelo",
                };
            })
            .addCase(fetchDailyRealizationDemoThunk.pending, (s) => {
                s.dailyRealizationDemoLoading = true;
                s.dailyRealizationDemoError = null;
            })
            .addCase(fetchDailyRealizationDemoThunk.fulfilled, (s, a) => {
                s.dailyRealizationDemoLoading = false;
                s.dailyRealizationDemo = a.payload || null;
            })
            .addCase(fetchDailyRealizationDemoThunk.rejected, (s, a) => {
                s.dailyRealizationDemoLoading = false;
                s.dailyRealizationDemoError = a.payload?.message || "Greška pri dohvatu DEMO izvještaja";
            })
            .addCase(sendDailyRealizationDemoToErpThunk.pending, (s, a) => {
                const date = a.meta?.arg?.date;
                if (!date) return;
                s.dailyRealizationDemoSendByDay[date] = { loading: true, result: null, error: null };
            })
            .addCase(sendDailyRealizationDemoToErpThunk.fulfilled, (s, a) => {
                const date = a.payload?.date;
                if (!date) return;
                s.dailyRealizationDemoSendByDay[date] = {
                    loading: false,
                    result: a.payload?.response || {},
                    error: null,
                };
            })
            .addCase(sendDailyRealizationDemoToErpThunk.rejected, (s, a) => {
                const date = a.payload?.date || a.meta?.arg?.date;
                if (!date) return;
                s.dailyRealizationDemoSendByDay[date] = {
                    loading: false,
                    result: null,
                    error: a.payload?.error?.message || a.error?.message || "Slanje u ERP nije uspjelo",
                };
            })
            // Sve izmjene platnog naloga dijele isti par zastavica — u sučelju se
            // u jednom trenutku radi samo jedna od njih. Matcheri idu na kraj
            // lanca, jer RTK ne dopušta addCase nakon addMatcher.
            .addMatcher(
                (a) => /^finance\/(createPaymentOrder|setPaymentOrderStatus|addPaymentOrderItem|deletePaymentOrderItem)\/pending$/.test(a.type),
                (s) => { s.nalogSaving = true; s.nalogError = null; }
            )
            .addMatcher(
                (a) => /^finance\/(createPaymentOrder|setPaymentOrderStatus|addPaymentOrderItem|deletePaymentOrderItem)\/fulfilled$/.test(a.type),
                (s) => { s.nalogSaving = false; }
            )
            .addMatcher(
                (a) => /^finance\/(createPaymentOrder|setPaymentOrderStatus|addPaymentOrderItem|deletePaymentOrderItem)\/rejected$/.test(a.type),
                (s, a) => { s.nalogSaving = false; s.nalogError = a.payload?.message || "Spremanje nije uspjelo"; }
            );
    },
});

export const financeSliceData = (state) => state.finance;
export const { setFilter, resetFilters, setPartnerInvoiceFilter, setTicketsFilter, setHarborTaxReportFilter, setManagementReportMonth, setPurchaseReportMonth, setShiftsFilter, setDailyRealizationFilter, clearDailyRealizationSendResult, setDailyRealizationDemoFilter, clearDailyRealizationDemoSendResult } = financeSlice.actions;
export const invoicePdfUrl = (invoice_uuid) => `${backendURL}/portal/transactions/invoice_pdf/${invoice_uuid}`;
// Karte se u PDF vade po narudžbi, ne po računu — isto kao u POS prodaji.
export const ticketsPdfUrl = (order_uuid) => `${backendURL}/portal/transactions/tickets_pdf/${order_uuid}`;

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

// Obračun lučkih naknada u PDF-u. Bez `region` preuzima se zbirni izvještaj za
// sve uprave, s njim samo ta uprava — svakoj se predaje njezin obračun. Ime
// datoteke slaže backend, pa se ovdje čita iz content-disposition.
export const downloadHarborTaxPdf = async ({ year, month, region } = {}) => {
    const resp = await api.get("/portal/transactions/harbor_tax_report_pdf", {
        params: { year, month: month || undefined, region: region || undefined },
        responseType: "blob",
    });
    const disposition = resp.headers?.["content-disposition"] || "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const blob = new Blob([resp.data], { type: "application/pdf" });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = match?.[1] || `lucke-naknade-${year}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
};

// SEPA datoteka za e-bankarstvo (pain.001). Ime datoteke slaže backend, pa se
// čita iz content-disposition. Greška dolazi kao JSON — pročita se iz blob-a i
// vrati kao poruka, da se korisniku ne spremi datoteka s greškom.
export const downloadSepaXml = async (payment_order_uuid, { execution_date } = {}) => {
    const resp = await api.get(`/portal/transactions/payment_order_xml/${payment_order_uuid}`, {
        params: { execution_date: execution_date || undefined },
        responseType: "blob",
        validateStatus: () => true,
    });

    const tip = resp.data?.type || "";
    if (resp.status !== 200 || tip.includes("json")) {
        const tekst = await resp.data.text();
        let poruka = tekst;
        try {
            const p = JSON.parse(tekst);
            // Kroz gateway poruka dođe raspakirana, izravno s BFF-a je pod `data`.
            poruka = p?.data?.message || p?.message || tekst;
        } catch { /* ostaje sirovi tekst */ }
        throw new Error(poruka || "SEPA datoteka nije generirana");
    }

    const disposition = resp.headers?.["content-disposition"] || "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const blob = new Blob([resp.data], { type: "application/xml" });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = match?.[1] || `sepa-${payment_order_uuid.slice(0, 8)}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
};

export default financeSlice.reducer;
